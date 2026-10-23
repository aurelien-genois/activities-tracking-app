import {
  type ActivityFieldErrors,
  activityFormSchema,
  type ActivityFormValues,
  getFieldErrors,
} from "./schema";
import { toActivityInterval } from "./time";

export type ActivityFormErrors = { fieldErrors: ActivityFieldErrors; formError?: string };

export type ActivityFormCheck =
  { ok: true; data: ActivityFormValues } | ({ ok: false } & ActivityFormErrors);

/**
 * Client-side pre-check with the same rules as the server actions (shared
 * schema + DST/future check). Overlap is checked by the server only.
 */
export function validateActivityForm(
  values: unknown,
  timeZone: string,
  now: Date = new Date(),
): ActivityFormCheck {
  const parsed = activityFormSchema.safeParse(values);
  if (!parsed.success) {
    const formError = parsed.error.issues.find((issue) => issue.path.length === 0)?.message;
    return { ok: false, fieldErrors: getFieldErrors(parsed.error), formError };
  }
  const interval = toActivityInterval(parsed.data, timeZone, now);
  if (!interval.ok) return interval;
  return { ok: true, data: parsed.data };
}
