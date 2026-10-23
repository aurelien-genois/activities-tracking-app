// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { activity: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import {
  buildHistoryWhere,
  getHistory,
  getLatestActivityEnd,
  getRecentActivities,
  HISTORY_PAGE_SIZE,
} from "./queries";
import { parseHistoryFilters } from "./schema";

beforeEach(() => {
  prisma.activity.findMany.mockReset().mockResolvedValue([]);
  prisma.activity.findFirst.mockReset();
  prisma.activity.count.mockReset().mockResolvedValue(0);
});

describe("getRecentActivities", () => {
  it("returns the latest 10 activities, most recent first", async () => {
    const rows = [{ id: "a" }];
    prisma.activity.findMany.mockResolvedValue(rows);

    await expect(getRecentActivities()).resolves.toBe(rows);
    expect(prisma.activity.findMany).toHaveBeenCalledWith({
      orderBy: { startAt: "desc" },
      take: 10,
    });
  });
});

describe("getLatestActivityEnd", () => {
  it("returns the greatest endAt", async () => {
    const endAt = new Date("2026-10-23T08:00:00Z");
    prisma.activity.findFirst.mockResolvedValue({ endAt });

    await expect(getLatestActivityEnd()).resolves.toBe(endAt);
    expect(prisma.activity.findFirst).toHaveBeenCalledWith({
      orderBy: { endAt: "desc" },
      select: { endAt: true },
    });
  });

  it("returns null when there is no activity", async () => {
    prisma.activity.findFirst.mockResolvedValue(null);
    await expect(getLatestActivityEnd()).resolves.toBeNull();
  });
});

describe("buildHistoryWhere", () => {
  it("is empty without filters", () => {
    expect(buildHistoryWhere(parseHistoryFilters({}))).toEqual({});
  });

  it("searches notes case-insensitively and filters by category and subcategory", () => {
    expect(
      buildHistoryWhere(
        parseHistoryFilters({ q: "Soupe", category: "MANGER", subcategory: "Dîner" }),
      ),
    ).toEqual({
      notes: { contains: "Soupe", mode: "insensitive" },
      category: "MANGER",
      subcategory: "Dîner",
    });
  });
});

describe("getHistory", () => {
  it("paginates 20 per page, sorted by date descending, with the total", async () => {
    const rows = [{ id: "a" }];
    prisma.activity.findMany.mockResolvedValue(rows);
    prisma.activity.count.mockResolvedValue(45);

    const filters = parseHistoryFilters({ category: "LOISIR", subcategory: "Écouter", page: "2" });
    await expect(getHistory(filters)).resolves.toEqual({
      items: rows,
      total: 45,
      page: 2,
      pageCount: 3,
    });

    const where = { category: "LOISIR", subcategory: "Écouter" };
    expect(prisma.activity.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { startAt: "desc" },
      skip: HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
    });
    expect(prisma.activity.count).toHaveBeenCalledWith({ where });
  });

  it("returns at least one page when empty", async () => {
    await expect(getHistory(parseHistoryFilters({ q: "Création" }))).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { notes: { contains: "Création", mode: "insensitive" } },
        skip: 0,
      }),
    );
  });
});
