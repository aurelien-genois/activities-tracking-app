import { redirect } from "next/navigation";

import { HistoryFilters } from "@/features/activities/components/HistoryFilters";
import { HistoryList } from "@/features/activities/components/HistoryList";
import { Pagination } from "@/features/activities/components/Pagination";
import { buildHistoryHref, formatResultCount } from "@/features/activities/history";
import { getHistory } from "@/features/activities/queries";
import { parseHistoryFilters } from "@/features/activities/schema";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const timeZone = getEnv().APP_TIMEZONE;
  const { page, ...filters } = parseHistoryFilters(await searchParams);
  const history = await getHistory({ ...filters, page });

  // Out-of-range page (e.g. after deleting the last item of the last page): go to the last page.
  if (page > history.pageCount) redirect(buildHistoryHref({ ...filters, page: history.pageCount }));

  const activities = history.items.map(({ id, startAt, endAt, category, subcategory, notes }) => ({
    id,
    startAt,
    endAt,
    category,
    subcategory,
    notes,
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">History</h1>
      {/* Keyed so the search input resets when the URL filters change (e.g. Clear filters). */}
      <HistoryFilters key={buildHistoryHref(filters)} filters={filters} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {formatResultCount(history.total)}
      </p>
      <HistoryList activities={activities} timeZone={timeZone} />
      {history.total > 0 ? (
        <Pagination page={history.page} pageCount={history.pageCount} filters={filters} />
      ) : null}
    </div>
  );
}
