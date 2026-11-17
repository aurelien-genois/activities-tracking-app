import { cn } from "@/lib/utils";

import { CATEGORY_STYLE, type CategoryStyle } from "../categoryColors";
import { groupByDay } from "../history";
import { durationMinutes, formatDuration, formatTimeRange } from "../time";
import { DeleteActivityButton } from "./DeleteActivityButton";
import { EditActivityDialog, type EditableActivity } from "./EditActivityDialog";

export const HISTORY_EMPTY_MESSAGE = "No activities found.";

export type HistoryListProps = {
  /** Already sorted by `startAt` descending. */
  activities: EditableActivity[];
  timeZone: string;
};

/** `category` is a free string: own keys only, so `__proto__` or `toString` stay neutral. */
function styleFor(category: string): CategoryStyle | undefined {
  return Object.hasOwn(CATEGORY_STYLE, category)
    ? CATEGORY_STYLE[category as keyof typeof CATEGORY_STYLE]
    : undefined;
}

/** Activities grouped by local day, each with Edit and Delete actions. */
export function HistoryList({ activities, timeZone }: HistoryListProps) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{HISTORY_EMPTY_MESSAGE}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByDay(activities, timeZone).map((group) => {
        const headingId = `history-day-${group.date}`;
        return (
          <section key={group.date} aria-labelledby={headingId} className="flex flex-col gap-1.5">
            <h2 id={headingId} className="text-sm font-semibold text-muted-foreground">
              <time dateTime={group.date}>{group.label}</time>
            </h2>
            <ul className="divide-y rounded-md border">
              {group.items.map((activity) => {
                const style = styleFor(activity.category);
                return (
                  <li
                    key={activity.id}
                    className={cn(
                      "flex flex-col gap-2 border-l-4 border-l-transparent px-3 py-2.5 text-sm",
                      style?.stripe,
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="tabular-nums">{formatTimeRange(activity, timeZone)}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatDuration(durationMinutes(activity.startAt, activity.endAt))}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "w-fit max-w-full truncate py-0.5 text-xs font-medium",
                        style && `rounded-full border px-2 ${style.chip}`,
                      )}
                    >
                      {activity.category} &gt; {activity.subcategory}
                    </span>
                    {activity.notes ? (
                      <p className="line-clamp-3 whitespace-pre-line break-words text-muted-foreground">
                        {activity.notes}
                      </p>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <EditActivityDialog activity={activity} timeZone={timeZone} />
                      <DeleteActivityButton activity={activity} timeZone={timeZone} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
