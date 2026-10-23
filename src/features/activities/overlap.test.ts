// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { findOverlap, type OverlapClient, overlaps } from "./overlap";

const at = (time: string) => new Date(`2026-10-20T${time}:00Z`);
const interval = (start: string, end: string) => ({ startAt: at(start), endAt: at(end) });

describe("overlaps", () => {
  const existing = interval("09:00", "10:00");

  it.each([
    ["partial overlap at the end", "09:30", "10:30"],
    ["partial overlap at the start", "08:30", "09:30"],
    ["new contained in existing", "09:15", "09:45"],
    ["existing contained in new", "08:00", "11:00"],
    ["identical", "09:00", "10:00"],
    ["same start, shorter", "09:00", "09:30"],
    ["same end, shorter", "09:30", "10:00"],
  ])("detects %s", (_label, start, end) => {
    expect(overlaps(interval(start, end), existing)).toBe(true);
    expect(overlaps(existing, interval(start, end))).toBe(true);
  });

  it.each([
    ["back-to-back after", "10:00", "11:00"],
    ["back-to-back before", "08:00", "09:00"],
    ["fully after", "10:30", "11:00"],
    ["fully before", "07:00", "08:00"],
  ])("allows %s", (_label, start, end) => {
    expect(overlaps(interval(start, end), existing)).toBe(false);
    expect(overlaps(existing, interval(start, end))).toBe(false);
  });
});

function clientReturning(value: unknown) {
  const findFirst = vi.fn().mockResolvedValue(value);
  return { client: { activity: { findFirst } } as unknown as OverlapClient, findFirst };
}

describe("findOverlap", () => {
  it("queries activities with start < newEnd and end > newStart", async () => {
    const conflict = { id: "a1", ...interval("09:00", "10:00"), category: "X", subcategory: "Y" };
    const { client, findFirst } = clientReturning(conflict);

    await expect(findOverlap(client, interval("09:30", "10:30"))).resolves.toBe(conflict);
    expect(findFirst).toHaveBeenCalledWith({
      where: { startAt: { lt: at("10:30") }, endAt: { gt: at("09:30") } },
      orderBy: { startAt: "asc" },
      select: { id: true, startAt: true, endAt: true, category: true, subcategory: true },
    });
  });

  it("excludes the edited activity (self-exclusion on update)", async () => {
    const { client, findFirst } = clientReturning(null);

    await expect(
      findOverlap(client, { ...interval("09:00", "10:00"), excludeId: "self" }),
    ).resolves.toBeNull();
    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: { not: "self" },
      startAt: { lt: at("10:00") },
      endAt: { gt: at("09:00") },
    });
  });
});
