import { instantToZoned } from "@/lib/datetime";

import { type Category } from "./constants";
import { formatDayLabel } from "./time";

export const HISTORY_PATH = "/history";

export type HistoryParams = {
  q?: string;
  category?: Category | "";
  subcategory?: string;
  page?: number;
};

/**
 * `/history` href with only the meaningful params (empty values and page 1
 * omitted). A subcategory without category is dropped.
 */
export function buildHistoryHref({ q, category, subcategory, page }: HistoryParams = {}): string {
  const params = new URLSearchParams();
  const query = q?.trim();
  if (query) params.set("q", query);
  if (category) {
    params.set("category", category);
    if (subcategory) params.set("subcategory", subcategory);
  }
  if (page && page > 1) params.set("page", String(Math.floor(page)));
  const search = params.toString();
  return search ? `${HISTORY_PATH}?${search}` : HISTORY_PATH;
}

export function hasActiveFilters({ q, category, subcategory }: HistoryParams): boolean {
  return Boolean(q?.trim() || category || subcategory);
}

/** Page number within `1..pageCount` (pageCount < 1 is treated as 1). */
export function clampPage(page: number, pageCount: number): number {
  const last = Math.max(1, Math.floor(pageCount));
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), last);
}

export type DayGroup<T> = { date: string; label: string; items: T[] };

/** Groups activities (already sorted) by local day of `startAt` in `timeZone`, keeping order. */
export function groupByDay<T extends { startAt: Date }>(
  items: readonly T[],
  timeZone: string,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const date = instantToZoned(item.startAt, timeZone).date;
    const last = groups.at(-1);
    if (last?.date === date) {
      last.items.push(item);
    } else {
      groups.push({
        date,
        label: `${formatDayLabel(item.startAt, timeZone)} ${date.slice(0, 4)}`,
        items: [item],
      });
    }
  }
  return groups;
}

export function formatResultCount(total: number): string {
  return `${total} ${total === 1 ? "activity" : "activities"}`;
}
