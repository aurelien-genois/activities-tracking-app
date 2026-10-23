// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as SaveModule from "./save";

const { auth, revalidatePath, prisma, saveActivity } = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  prisma: { activity: { delete: vi.fn() } },
  saveActivity: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "Europe/Paris" }) }));
vi.mock("./save", async (importOriginal) => ({
  ...(await importOriginal<typeof SaveModule>()),
  saveActivity,
}));

import { createActivity, deleteActivity, updateActivity } from "./actions";
import { ACTIVITY_MESSAGES as M } from "./schema";

const NOW = new Date("2026-10-23T14:30:00Z"); // 16:30 in Paris

const input = {
  date: "2026-10-23",
  startTime: "09:00",
  endTime: "10:00",
  category: "MANGER",
  subcategory: "Dîner",
  notes: "",
};

const saved = {
  id: "a1",
  startAt: new Date("2026-10-23T07:00:00Z"),
  endAt: new Date("2026-10-23T08:00:00Z"),
  category: "MANGER",
  subcategory: "Dîner",
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const expectedData = {
  startAt: saved.startAt,
  endAt: saved.endAt,
  category: "MANGER",
  subcategory: "Dîner",
  notes: null,
};

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  auth.mockReset().mockResolvedValue({ user: { email: "admin@example.com" } });
  revalidatePath.mockReset();
  saveActivity.mockReset().mockResolvedValue({ ok: true, activity: saved });
  prisma.activity.delete.mockReset().mockResolvedValue(saved);
  return () => vi.useRealTimers();
});

describe("createActivity", () => {
  it("validates, converts in APP_TIMEZONE, saves and revalidates pages", async () => {
    await expect(createActivity(input)).resolves.toEqual({ ok: true, activity: saved });

    expect(saveActivity).toHaveBeenCalledWith(prisma, expectedData, undefined);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/history");
  });

  it("accepts FormData", async () => {
    const formData = new FormData();
    for (const [key, value] of Object.entries({ ...input, notes: "  soup " })) {
      formData.set(key, value);
    }

    await expect(createActivity(formData)).resolves.toMatchObject({ ok: true });
    expect(saveActivity).toHaveBeenCalledWith(
      prisma,
      { ...expectedData, notes: "soup" },
      undefined,
    );
  });

  it.each([null, {}, { user: null }])("rejects unauthenticated calls (session %j)", async (s) => {
    auth.mockResolvedValue(s);

    await expect(createActivity(input)).resolves.toEqual({
      ok: false,
      fieldErrors: {},
      formError: "You must be signed in.",
    });
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("returns field errors from the shared schema", async () => {
    await expect(
      createActivity({ ...input, category: "TRAVAIL", endTime: "08:00" }),
    ).resolves.toEqual({
      ok: false,
      fieldErrors: { subcategory: [M.subcategoryMismatch], endTime: [M.endBeforeStart] },
      formError: undefined,
    });
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("returns a form error for non-object input", async () => {
    const result = await createActivity("nope");
    expect(result).toMatchObject({ ok: false, fieldErrors: {} });
    expect(result.ok === false && result.formError).toEqual(expect.any(String));
  });

  it("rejects activities in the future", async () => {
    await expect(
      createActivity({ ...input, startTime: "16:00", endTime: "17:00" }),
    ).resolves.toEqual({ ok: false, fieldErrors: {}, formError: M.future });
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("rejects non-existent DST times", async () => {
    await expect(
      createActivity({ ...input, date: "2026-03-29", startTime: "02:30", endTime: "04:00" }),
    ).resolves.toEqual({ ok: false, fieldErrors: { startTime: [M.startTimeNonexistent] } });
  });

  it("reports overlaps with the conflicting activity times in APP_TIMEZONE", async () => {
    saveActivity.mockResolvedValue({
      ok: false,
      reason: "overlap",
      conflict: { ...saved, startAt: new Date("2026-10-23T06:30:00Z") },
    });

    await expect(createActivity(input)).resolves.toEqual({
      ok: false,
      fieldErrors: {},
      formError: "This activity overlaps an existing activity (08:30 - 10:00, MANGER > Dîner).",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("asks to retry after repeated serialization failures", async () => {
    saveActivity.mockResolvedValue({ ok: false, reason: "conflict-retry" });

    await expect(createActivity(input)).resolves.toMatchObject({
      ok: false,
      formError: expect.stringContaining("Please retry"),
    });
  });
});

describe("updateActivity", () => {
  it("saves with the activity id (self-excluded from the overlap check)", async () => {
    await expect(updateActivity("a1", input)).resolves.toEqual({ ok: true, activity: saved });
    expect(saveActivity).toHaveBeenCalledWith(prisma, expectedData, "a1");
    expect(revalidatePath).toHaveBeenCalledWith("/history");
  });

  it("rejects unauthenticated calls", async () => {
    auth.mockResolvedValue(null);
    await expect(updateActivity("a1", input)).resolves.toMatchObject({
      ok: false,
      formError: "You must be signed in.",
    });
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("uses the same validation as creation", async () => {
    await expect(updateActivity("a1", { ...input, notes: "x".repeat(1001) })).resolves.toEqual({
      ok: false,
      fieldErrors: { notes: [M.notesTooLong] },
      formError: undefined,
    });
  });

  it("returns not found for missing activities", async () => {
    saveActivity.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(updateActivity("missing", input)).resolves.toEqual({
      ok: false,
      fieldErrors: {},
      formError: "Activity not found. It may have been deleted.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["", 42, "x".repeat(65)])("returns not found for invalid id %j", async (id) => {
    await expect(updateActivity(id as string, input)).resolves.toMatchObject({
      ok: false,
      formError: "Activity not found. It may have been deleted.",
    });
    expect(saveActivity).not.toHaveBeenCalled();
  });
});

describe("deleteActivity", () => {
  it("deletes without any overlap check and revalidates pages", async () => {
    await expect(deleteActivity("a1")).resolves.toEqual({ ok: true });
    expect(prisma.activity.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(saveActivity).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/history");
  });

  it("rejects unauthenticated calls", async () => {
    auth.mockResolvedValue(null);
    await expect(deleteActivity("a1")).resolves.toEqual({
      ok: false,
      formError: "You must be signed in.",
    });
    expect(prisma.activity.delete).not.toHaveBeenCalled();
  });

  it("returns not found when the activity does not exist (P2025)", async () => {
    prisma.activity.delete.mockRejectedValue(Object.assign(new Error("x"), { code: "P2025" }));
    await expect(deleteActivity("missing")).resolves.toEqual({
      ok: false,
      formError: "Activity not found. It may have been deleted.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns not found for an invalid id", async () => {
    await expect(deleteActivity("")).resolves.toMatchObject({ ok: false });
    expect(prisma.activity.delete).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    prisma.activity.delete.mockRejectedValue(new Error("db down"));
    await expect(deleteActivity("a1")).rejects.toThrow("db down");
  });
});
