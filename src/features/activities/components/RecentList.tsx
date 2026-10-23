import type { Activity } from "@/generated/prisma/client";
import { todayInTz } from "@/lib/datetime";

import { durationMinutes, formatDayLabel, formatDuration, formatTimeRange } from "../time";

export const RECENT_HEADING = "Recent activities";
export const RECENT_EMPTY_MESSAGE = "No activities yet.";

export type RecentActivity = Pick<
  Activity,
  "id" | "startAt" | "endAt" | "category" | "subcategory"
>;

export type RecentListProps = {
  /** Already ordered (most recent first) and limited by the query. */
  activities: RecentActivity[];
  timeZone: string;
  /** Injected for tests; defaults to the render time. */
  now?: Date;
};

/** Presentational list of the latest activities (no client JS needed). */
export function RecentList({ activities, timeZone, now = new Date() }: RecentListProps) {
  const today = todayInTz(now, timeZone);

  return (
    <section aria-labelledby="recent-activities-heading" className="flex flex-col gap-2">
      <h2 id="recent-activities-heading" className="text-sm font-semibold text-muted-foreground">
        {RECENT_HEADING}
      </h2>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{RECENT_EMPTY_MESSAGE}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {activities.map((activity) => {
            const isToday = todayInTz(activity.startAt, timeZone) === today;
            return (
              <li key={activity.id} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="tabular-nums">
                    {isToday ? null : (
                      <span className="mr-2 text-xs text-muted-foreground">
                        {formatDayLabel(activity.startAt, timeZone)}
                      </span>
                    )}
                    {formatTimeRange(activity, timeZone)}
                  </span>
                  <span className="truncate font-medium">
                    {activity.category} &gt; {activity.subcategory}
                  </span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDuration(durationMinutes(activity.startAt, activity.endAt))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
