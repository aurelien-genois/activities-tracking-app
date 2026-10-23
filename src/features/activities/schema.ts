import { z } from "zod";

import { isValidDateString, isValidTimeString, timeToMinutes } from "@/lib/datetime";

import { CATEGORY_KEYS, isCategory, isSubcategoryOf } from "./constants";

export const NOTES_MAX_LENGTH = 1000;
export const HISTORY_QUERY_MAX_LENGTH = 100;

export const ACTIVITY_MESSAGES = {
  dateRequired: "Date is required.",
  dateInvalid: "Date must be a valid date.",
  startTimeRequired: "Start time is required.",
  startTimeInvalid: "Start time must be a valid time (HH:mm).",
  endTimeRequired: "End time is required.",
  endTimeInvalid: "End time must be a valid time (HH:mm).",
  endBeforeStart: "End time must be after start time.",
  crossesMidnight: "Activity cannot cross midnight.",
  categoryRequired: "Category is required.",
  categoryInvalid: "Category is invalid.",
  subcategoryRequired: "Subcategory is required.",
  subcategoryMismatch: "Subcategory must belong to the selected category.",
  notesTooLong: `Notes must be at most ${NOTES_MAX_LENGTH} characters.`,
  startTimeNonexistent: "Start time does not exist on this date (daylight saving time change).",
  endTimeNonexistent: "End time does not exist on this date (daylight saving time change).",
  future: "Activity cannot be in the future.",
} as const;

const M = ACTIVITY_MESSAGES;

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

/**
 * Required trimmed string with a single "required" message for missing/empty
 * input; the format check is skipped for empty values (no duplicate message)
 * without aborting, so the cross-field checks still run.
 */
function requiredString(
  requiredMessage: string,
  format?: { isValid: (value: string) => boolean; message: string },
) {
  const schema = z.string({ error: requiredMessage }).trim().min(1, { error: requiredMessage });
  return format
    ? schema.refine((value) => !value || format.isValid(value), { error: format.message })
    : schema;
}

export const activityFormSchema = z
  .object({
    date: requiredString(M.dateRequired, { isValid: isValidDateString, message: M.dateInvalid }),
    startTime: requiredString(M.startTimeRequired, {
      isValid: isValidTimeString,
      message: M.startTimeInvalid,
    }),
    endTime: requiredString(M.endTimeRequired, {
      isValid: isValidTimeString,
      message: M.endTimeInvalid,
    }),
    category: z.enum(CATEGORY_KEYS, {
      error: (issue) => (isBlank(issue.input) ? M.categoryRequired : M.categoryInvalid),
    }),
    subcategory: requiredString(M.subcategoryRequired).transform((value) => value.normalize("NFC")),
    notes: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() || undefined : value),
      z.string().max(NOTES_MAX_LENGTH, { error: M.notesTooLong }).optional(),
    ),
  })
  .superRefine(
    (values, ctx) => {
      // Runs even when other fields failed, so each check guards its own inputs.
      const { category, subcategory, startTime, endTime } = values as Partial<
        Record<keyof typeof values, unknown>
      >;
      if (isCategory(category) && typeof subcategory === "string" && subcategory) {
        if (!isSubcategoryOf(category, subcategory.normalize("NFC"))) {
          ctx.addIssue({ code: "custom", path: ["subcategory"], message: M.subcategoryMismatch });
        }
      }
      if (
        typeof startTime === "string" &&
        typeof endTime === "string" &&
        isValidTimeString(startTime) &&
        isValidTimeString(endTime)
      ) {
        if (endTime === "00:00") {
          ctx.addIssue({ code: "custom", path: ["endTime"], message: M.crossesMidnight });
        } else if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
          ctx.addIssue({ code: "custom", path: ["endTime"], message: M.endBeforeStart });
        }
      }
    },
    { when: (payload) => typeof payload.value === "object" && payload.value !== null },
  );

export type ActivityFormInput = z.input<typeof activityFormSchema>;
export type ActivityFormValues = z.output<typeof activityFormSchema>;
export type ActivityField = keyof ActivityFormValues;
export type ActivityFieldErrors = Partial<Record<ActivityField, string[]>>;

/** Field errors of a failed parse, keyed by form field. */
export function getFieldErrors(error: z.ZodError<ActivityFormValues>): ActivityFieldErrors {
  return z.flattenError(error).fieldErrors as ActivityFieldErrors;
}

function firstString(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export const historyFilterSchema = z
  .object({
    q: z.preprocess(
      firstString,
      z
        .string()
        .trim()
        .max(HISTORY_QUERY_MAX_LENGTH)
        .transform((value) => value || undefined)
        .optional()
        .catch(undefined),
    ),
    category: z.preprocess(firstString, z.enum(CATEGORY_KEYS).optional().catch(undefined)),
    subcategory: z.preprocess(
      firstString,
      z
        .string()
        .transform((value) => value.normalize("NFC"))
        .optional()
        .catch(undefined),
    ),
    page: z.preprocess(
      firstString,
      z
        .string()
        .regex(/^\d{1,6}$/)
        .transform(Number)
        .pipe(z.number().int().min(1))
        .catch(1),
    ),
  })
  .transform(({ q, category, subcategory, page }) => ({
    q,
    category,
    subcategory: category && isSubcategoryOf(category, subcategory) ? subcategory : undefined,
    page,
  }));

export type HistoryFilters = z.output<typeof historyFilterSchema>;

type SearchParamsInput =
  URLSearchParams | Record<string, string | string[] | undefined> | null | undefined;

/** Parses history search params; invalid values are dropped (never throws). */
export function parseHistoryFilters(input: SearchParamsInput): HistoryFilters {
  const source =
    input instanceof URLSearchParams ? Object.fromEntries(input.entries()) : (input ?? {});
  return historyFilterSchema.parse(source);
}
