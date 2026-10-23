/**
 * Timezone helpers based on `Intl` only (no extra dependency).
 * Dates are `yyyy-MM-dd` strings, times are `HH:mm` strings (minute precision).
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type ZonedParts = {
  /** `yyyy-MM-dd` */
  date: string;
  /** `HH:mm` */
  time: string;
  minutesOfDay: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidTimeString(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Minutes since midnight for an `HH:mm` string. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Wall-clock parts of `instant` in `timeZone` (seconds are truncated). */
export function instantToZoned(instant: Date, timeZone: string): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of getFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  // Some engines still render midnight as "24" despite `hourCycle: "h23"`.
  const hour = values.hour % 24;
  return {
    date: `${values.year}-${pad(values.month)}-${pad(values.day)}`,
    time: `${pad(hour)}:${pad(values.minute)}`,
    minutesOfDay: hour * 60 + values.minute,
  };
}

/** Offset (wall clock minus UTC, in ms, minute precision) of `timeZone` at `instantMs`. */
function offsetAt(instantMs: number, timeZone: string): number {
  const { date, minutesOfDay } = instantToZoned(new Date(instantMs), timeZone);
  const [year, month, day] = date.split("-").map(Number);
  const wallMs = Date.UTC(year, month - 1, day) + minutesOfDay * MINUTE_MS;
  return wallMs - Math.floor(instantMs / MINUTE_MS) * MINUTE_MS;
}

/**
 * Converts a wall-clock date + time in `timeZone` to an instant.
 * - Returns `null` for malformed input or for a local time that does not exist
 *   (spring-forward DST gap, e.g. 02:30 on the last Sunday of March in Europe/Paris).
 * - An ambiguous local time (autumn fall-back) resolves to its first occurrence.
 */
export function zonedDateTimeToInstant(date: string, time: string, timeZone: string): Date | null {
  if (!isValidDateString(date) || !isValidTimeString(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const wallMs = Date.UTC(year, month - 1, day) + timeToMinutes(time) * MINUTE_MS;

  const offsets = new Set(
    [wallMs - DAY_MS, wallMs, wallMs + DAY_MS].map((probe) => offsetAt(probe, timeZone)),
  );
  const candidates = [...offsets]
    .map((offset) => wallMs - offset)
    .filter((instantMs) => {
      const zoned = instantToZoned(new Date(instantMs), timeZone);
      return zoned.date === date && zoned.time === time;
    })
    .sort((a, b) => a - b);

  return candidates.length > 0 ? new Date(candidates[0]) : null;
}

/** Today's date (`yyyy-MM-dd`) in `timeZone`. */
export function todayInTz(now: Date, timeZone: string): string {
  return instantToZoned(now, timeZone).date;
}

/** Current wall-clock time (`HH:mm`) in `timeZone`. */
export function nowTimeInTz(now: Date, timeZone: string): string {
  return instantToZoned(now, timeZone).time;
}
