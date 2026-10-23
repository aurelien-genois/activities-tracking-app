import type { Activity, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { type HistoryFilters } from "./schema";

export const RECENT_ACTIVITIES_LIMIT = 10;
export const HISTORY_PAGE_SIZE = 20;

export function getRecentActivities(): Promise<Activity[]> {
  return prisma.activity.findMany({
    orderBy: { startAt: "desc" },
    take: RECENT_ACTIVITIES_LIMIT,
  });
}

/** End of the latest activity (greatest `endAt`), used for the default start time. */
export async function getLatestActivityEnd(): Promise<Date | null> {
  const latest = await prisma.activity.findFirst({
    orderBy: { endAt: "desc" },
    select: { endAt: true },
  });
  return latest?.endAt ?? null;
}

export type HistoryPage = {
  items: Activity[];
  total: number;
  page: number;
  pageCount: number;
};

export function buildHistoryWhere(filters: HistoryFilters): Prisma.ActivityWhereInput {
  return {
    ...(filters.q ? { notes: { contains: filters.q, mode: "insensitive" } } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.subcategory ? { subcategory: filters.subcategory } : {}),
  };
}

export async function getHistory(filters: HistoryFilters): Promise<HistoryPage> {
  const where = buildHistoryWhere(filters);
  const [items, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { startAt: "desc" },
      skip: (filters.page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
    }),
    prisma.activity.count({ where }),
  ]);
  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
  };
}
