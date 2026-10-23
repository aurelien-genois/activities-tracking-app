import { instantToZoned, nowTimeInTz, todayInTz, zonedDateTimeToInstant } from "@/lib/datetime";

import { ACTIVITY_MESSAGES, type ActivityFieldErrors, type ActivityFormValues } from "./schema";

export type ActivityInterval = { startAt: Date; endAt: Date };

export type ActivityIntervalResult =
  | ({ ok: true } & ActivityInterval)
  | { ok: false; fieldErrors: ActivityFieldErrors; formError?: string };

/**
 * Converts validated form values to UTC instants in `timeZone` and rejects
 * non-existent local times (DST gap) and activities in the future. `now` is
 * injected so client and server share the same pure logic.
 */
export function toActivityInterval(
  values: Pick<ActivityFormValues, "date" | "startTime" | "endTime">,
  timeZone: string,
  now: Date,
): ActivityIntervalResult {
  const startAt = zonedDateTimeToInstant(values.date, values.startTime, timeZone);
  const endAt = zonedDateTimeToInstant(values.date, values.endTime, timeZone);

  const fieldErrors: ActivityFieldErrors = {};
  if (!startAt) fieldErrors.startTime = [ACTIVITY_MESSAGES.startTimeNonexistent];
  if (!endAt) fieldErrors.endTime = [ACTIVITY_MESSAGES.endTimeNonexistent];
  if (!startAt || !endAt) return { ok: false, fieldErrors };

  if (endAt <= startAt) {
    return { ok: false, fieldErrors: { endTime: [ACTIVITY_MESSAGES.endBeforeStart] } };
  }
  if (startAt > now || endAt > now) {
    return { ok: false, fieldErrors: {}, formError: ACTIVITY_MESSAGES.future };
  }
  return { ok: true, startAt, endAt };
}

/**
 * Default start time (validated decision 1):
 * - no activity: current time;
 * - latest activity ended today (in `timeZone`): its end time;
 * - latest activity ended on a previous day: 00:00.
 */
export function getDefaultStartTime(
  latestEndAt: Date | null | undefined,
  timeZone: string,
  now: Date,
): string {
  if (!latestEndAt) return nowTimeInTz(now, timeZone);
  const latest = instantToZoned(latestEndAt, timeZone);
  const today = todayInTz(now, timeZone);
  if (latest.date === today) return latest.time;
  return latest.date < today ? "00:00" : nowTimeInTz(now, timeZone);
}

export type ActivityFormDefaults = {
  date: string;
  startTime: string;
  endTime: string;
  category: "";
  subcategory: "";
  notes: "";
};

export function getActivityFormDefaults(
  latestEndAt: Date | null | undefined,
  timeZone: string,
  now: Date,
): ActivityFormDefaults {
  return {
    date: todayInTz(now, timeZone),
    startTime: getDefaultStartTime(latestEndAt, timeZone, now),
    endTime: nowTimeInTz(now, timeZone),
    category: "",
    subcategory: "",
    notes: "",
  };
}

/** Duration in whole minutes (computed, never stored). */
export function durationMinutes(startAt: Date, endAt: Date): number {
  return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60_000));
}

/** `45m`, `2h`, `1h 05m`. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, "0")}m`;
}

/** `HH:mm` of an instant in `timeZone`. */
export function formatTime(instant: Date, timeZone: string): string {
  return instantToZoned(instant, timeZone).time;
}

/** `HH:mm - HH:mm` of an activity in `timeZone`. */
export function formatTimeRange(interval: ActivityInterval, timeZone: string): string {
  return `${formatTime(interval.startAt, timeZone)} - ${formatTime(interval.endAt, timeZone)}`;
}

/** Form values (date, times) of a stored activity, derived from `startAt` in `timeZone`. */
export function activityToFormTimes(
  interval: ActivityInterval,
  timeZone: string,
): Pick<ActivityFormValues, "date" | "startTime" | "endTime"> {
  const start = instantToZoned(interval.startAt, timeZone);
  return { date: start.date, startTime: start.time, endTime: formatTime(interval.endAt, timeZone) };
}
