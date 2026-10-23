import { describe, expect, it } from "vitest";

import {
  buildHistoryHref,
  clampPage,
  formatResultCount,
  groupByDay,
  hasActiveFilters,
} from "./history";

describe("buildHistoryHref", () => {
  it("returns the bare path without params", () => {
    expect(buildHistoryHref()).toBe("/history");
    expect(buildHistoryHref({ q: "  ", category: "", page: 1 })).toBe("/history");
  });

  it("encodes trimmed query, category, accented subcategory and page", () => {
    const href = buildHistoryHref({
      q: " café noir ",
      category: "MANGER",
      subcategory: "Dîner",
      page: 3,
    });
    expect(href).toBe("/history?q=caf%C3%A9+noir&category=MANGER&subcategory=D%C3%AEner&page=3");
    const params = new URL(href, "http://x").searchParams;
    expect(params.get("q")).toBe("café noir");
    expect(params.get("subcategory")).toBe("Dîner");
  });

  it("drops a subcategory without category and page <= 1", () => {
    expect(buildHistoryHref({ subcategory: "Job", page: 0 })).toBe("/history");
    expect(buildHistoryHref({ category: "TRAVAIL", page: 2.7 })).toBe(
      "/history?category=TRAVAIL&page=2",
    );
  });
});

describe("hasActiveFilters", () => {
  it("is true when any filter is set", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ q: " " })).toBe(false);
    expect(hasActiveFilters({ q: "x" })).toBe(true);
    expect(hasActiveFilters({ category: "LOISIR" })).toBe(true);
    expect(hasActiveFilters({ subcategory: "Lecture" })).toBe(true);
  });
});

describe("clampPage", () => {
  it.each([
    [1, 1, 1],
    [3, 2, 2],
    [2, 5, 2],
    [0, 5, 1],
    [-4, 5, 1],
    [Number.NaN, 5, 1],
    [5, 0, 1],
    [2.9, 5, 2],
  ])("clampPage(%s, %s) = %s", (page, count, expected) => {
    expect(clampPage(page, count)).toBe(expected);
  });
});

describe("groupByDay", () => {
  it("groups consecutive activities by local day in the time zone", () => {
    const items = [
      { id: "a", startAt: new Date("2026-10-22T22:30:00Z") }, // 23 Oct 00:30 Paris
      { id: "b", startAt: new Date("2026-10-22T20:00:00Z") }, // 22 Oct 22:00 Paris
      { id: "c", startAt: new Date("2026-10-22T08:00:00Z") },
    ];
    const groups = groupByDay(items, "Europe/Paris");
    expect(groups.map((g) => [g.date, g.label, g.items.map((i) => i.id)])).toEqual([
      ["2026-10-23", "Fri 23 Oct 2026", ["a"]],
      ["2026-10-22", "Thu 22 Oct 2026", ["b", "c"]],
    ]);
    expect(groupByDay(items, "UTC").map((g) => g.items.length)).toEqual([3]);
    expect(groupByDay([], "UTC")).toEqual([]);
  });
});

describe("formatResultCount", () => {
  it("pluralizes", () => {
    expect(formatResultCount(0)).toBe("0 activities");
    expect(formatResultCount(1)).toBe("1 activity");
    expect(formatResultCount(25)).toBe("25 activities");
  });
});
