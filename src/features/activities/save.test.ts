// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { Activity } from "@/generated/prisma/client";

import { type ActivityData, MAX_SAVE_ATTEMPTS, saveActivity, type TransactionRunner } from "./save";

const at = (time: string) => new Date(`2026-10-20T${time}:00Z`);

function data(start: string, end: string): ActivityData {
  return {
    startAt: at(start),
    endAt: at(end),
    category: "TRAVAIL",
    subcategory: "Job",
    notes: null,
  };
}

type Where = {
  id?: { not?: string };
  startAt?: { lt: Date };
  endAt?: { gt: Date };
};

/** In-memory fake evaluating the overlap `where` clause like PostgreSQL would. */
function createFakeDb(initial: Array<Pick<Activity, "id" | "startAt" | "endAt">> = []) {
  const rows: Activity[] = initial.map((row) => ({
    category: "TRAVAIL",
    subcategory: "Job",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...row,
  }));
  let nextId = 1;
  const matches = (row: Activity, where: Where) =>
    (!where.id?.not || row.id !== where.id.not) &&
    (!where.startAt || row.startAt < where.startAt.lt) &&
    (!where.endAt || row.endAt > where.endAt.gt);

  const activity = {
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id) ?? null,
    ),
    findFirst: vi.fn(async ({ where }: { where: Where }) => {
      const found = rows
        .filter((row) => matches(row, where))
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
      return found
        ? {
            id: found.id,
            startAt: found.startAt,
            endAt: found.endAt,
            category: found.category,
            subcategory: found.subcategory,
          }
        : null;
    }),
    create: vi.fn(async ({ data: input }: { data: ActivityData }) => {
      const row = {
        id: `new-${nextId++}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
        notes: input.notes ?? null,
      };
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data: input }: { where: { id: string }; data: ActivityData }) => {
      const row = rows.find((candidate) => candidate.id === where.id)!;
      Object.assign(row, input);
      return row;
    }),
  };
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ activity }));
  return { client: { $transaction } as unknown as TransactionRunner, $transaction, activity, rows };
}

const existing = [{ id: "e1", startAt: at("09:00"), endAt: at("10:00") }];

describe("saveActivity - create", () => {
  it("creates the activity in a serializable transaction when there is no overlap", async () => {
    const db = createFakeDb(existing);

    const result = await saveActivity(db.client, data("10:00", "11:00"));

    expect(result).toMatchObject({ ok: true, activity: { id: "new-1", startAt: at("10:00") } });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(db.activity.findUnique).not.toHaveBeenCalled();
    expect(db.rows).toHaveLength(2);
  });

  it.each([
    ["partial overlap", "09:30", "10:30"],
    ["contained in existing", "09:15", "09:45"],
    ["identical", "09:00", "10:00"],
    ["existing contained in new", "08:00", "11:00"],
  ])("rejects %s and returns the conflicting activity", async (_label, start, end) => {
    const db = createFakeDb(existing);

    const result = await saveActivity(db.client, data(start, end));

    expect(result).toEqual({
      ok: false,
      reason: "overlap",
      conflict: expect.objectContaining({ id: "e1", startAt: at("09:00"), endAt: at("10:00") }),
    });
    expect(db.activity.create).not.toHaveBeenCalled();
  });

  it.each([
    ["right after", "10:00", "11:00"],
    ["right before", "08:00", "09:00"],
  ])("allows back-to-back activities (%s)", async (_label, start, end) => {
    const db = createFakeDb(existing);
    await expect(saveActivity(db.client, data(start, end))).resolves.toMatchObject({ ok: true });
  });
});

describe("saveActivity - update", () => {
  it("excludes the edited activity from the overlap check", async () => {
    const db = createFakeDb(existing);

    const result = await saveActivity(db.client, data("09:30", "10:30"), "e1");

    expect(result).toMatchObject({ ok: true, activity: { id: "e1", startAt: at("09:30") } });
    expect(db.activity.findFirst.mock.calls[0][0].where.id).toEqual({ not: "e1" });
    expect(db.activity.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: data("09:30", "10:30"),
    });
  });

  it("still rejects overlaps with other activities", async () => {
    const db = createFakeDb([...existing, { id: "e2", startAt: at("11:00"), endAt: at("12:00") }]);

    const result = await saveActivity(db.client, data("10:30", "11:30"), "e1");

    expect(result).toMatchObject({ ok: false, reason: "overlap", conflict: { id: "e2" } });
    expect(db.activity.update).not.toHaveBeenCalled();
  });

  it("returns not-found when the activity does not exist", async () => {
    const db = createFakeDb(existing);

    await expect(saveActivity(db.client, data("12:00", "13:00"), "missing")).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(db.activity.update).not.toHaveBeenCalled();
  });

  it("maps a P2025 error (deleted concurrently) to not-found", async () => {
    const db = createFakeDb(existing);
    db.activity.update.mockRejectedValueOnce(Object.assign(new Error("gone"), { code: "P2025" }));

    await expect(saveActivity(db.client, data("12:00", "13:00"), "e1")).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("saveActivity - serialization failures", () => {
  const serializationError = () => Object.assign(new Error("conflict"), { code: "P2034" });

  it("retries on P2034 and succeeds", async () => {
    const db = createFakeDb();
    db.$transaction
      .mockRejectedValueOnce(serializationError())
      .mockRejectedValueOnce(serializationError());

    await expect(saveActivity(db.client, data("12:00", "13:00"))).resolves.toMatchObject({
      ok: true,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it("retries on commit-time write conflicts raised by the pg driver adapter", async () => {
    const db = createFakeDb();
    const driverError = (cause: object) =>
      Object.assign(new Error("TransactionWriteConflict"), { name: "DriverAdapterError", cause });
    db.$transaction
      .mockRejectedValueOnce(driverError({ kind: "TransactionWriteConflict" }))
      .mockRejectedValueOnce(driverError({ originalCode: "40001" }));

    await expect(saveActivity(db.client, data("12:00", "13:00"))).resolves.toMatchObject({
      ok: true,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry other driver adapter errors", async () => {
    const db = createFakeDb();
    db.$transaction.mockRejectedValue(
      Object.assign(new Error("x"), { cause: { kind: "UniqueConstraintViolation" } }),
    );
    await expect(saveActivity(db.client, data("12:00", "13:00"))).rejects.toThrow("x");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("gives up after 3 retries with a retry result", async () => {
    const db = createFakeDb();
    db.$transaction.mockRejectedValue(serializationError());

    await expect(saveActivity(db.client, data("12:00", "13:00"))).resolves.toEqual({
      ok: false,
      reason: "conflict-retry",
    });
    expect(MAX_SAVE_ATTEMPTS).toBe(4);
    expect(db.$transaction).toHaveBeenCalledTimes(MAX_SAVE_ATTEMPTS);
  });

  it("rethrows unexpected errors without retrying", async () => {
    const db = createFakeDb();
    db.$transaction.mockRejectedValue(new Error("db down"));

    await expect(saveActivity(db.client, data("12:00", "13:00"))).rejects.toThrow("db down");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rethrows non-object errors", async () => {
    const db = createFakeDb();
    db.$transaction.mockRejectedValue("boom");

    await expect(saveActivity(db.client, data("12:00", "13:00"))).rejects.toBe("boom");
  });
});
