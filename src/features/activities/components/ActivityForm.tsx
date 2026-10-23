"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { nowTimeInTz, todayInTz } from "@/lib/datetime";

import { createActivity } from "../actions";
import { type ActivityFieldErrors, activityFormSchema, getFieldErrors } from "../schema";
import { toActivityInterval } from "../time";
import { ActivityFields, type ActivityFieldValues } from "./ActivityFields";

export const SAVED_MESSAGE = "Activity saved";
export const UNEXPECTED_ERROR_MESSAGE = "The activity could not be saved. Please retry.";

type Errors = { fieldErrors: ActivityFieldErrors; formError?: string };

const NO_ERRORS: Errors = { fieldErrors: {} };

/** Same checks as the server action (shared schema + future/DST check), run before submitting. */
function validate(
  values: ActivityFieldValues,
  timeZone: string,
): { ok: true; endTime: string } | ({ ok: false } & Errors) {
  const parsed = activityFormSchema.safeParse(values);
  if (!parsed.success) {
    const formError = parsed.error.issues.find((issue) => issue.path.length === 0)?.message;
    return { ok: false, fieldErrors: getFieldErrors(parsed.error), formError };
  }
  const interval = toActivityInterval(parsed.data, timeZone, new Date());
  if (!interval.ok) return interval;
  return { ok: true, endTime: parsed.data.endTime };
}

export type ActivityFormProps = {
  initialValues: ActivityFieldValues;
  timeZone: string;
};

export function ActivityForm({ initialValues, timeZone }: ActivityFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const [isPending, startTransition] = useTransition();

  function handleChange(patch: Partial<ActivityFieldValues>) {
    const changed = (Object.keys(patch) as (keyof ActivityFieldValues)[]).filter(
      (key) => patch[key] !== values[key],
    );
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const fieldErrors = { ...current.fieldErrors };
      for (const key of changed) delete fieldErrors[key];
      return { fieldErrors };
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const checked = validate(values, timeZone);
    if (!checked.ok) {
      setErrors({ fieldErrors: checked.fieldErrors, formError: checked.formError });
      return;
    }
    setErrors(NO_ERRORS);

    const submitted = { ...values };
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createActivity>>;
      try {
        result = await createActivity(submitted);
      } catch {
        setErrors({ fieldErrors: {}, formError: UNEXPECTED_ERROR_MESSAGE });
        return;
      }
      if (!result.ok) {
        setErrors({ fieldErrors: result.fieldErrors, formError: result.formError });
        return;
      }
      toast.success(SAVED_MESSAGE);
      const now = new Date();
      setValues({
        date: todayInTz(now, timeZone),
        startTime: checked.endTime,
        endTime: nowTimeInTz(now, timeZone),
        category: "",
        subcategory: "",
        notes: "",
      });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="New activity"
      className="flex flex-col gap-3"
    >
      <ActivityFields
        values={values}
        errors={errors.fieldErrors}
        onChange={handleChange}
        disabled={isPending}
      />

      {errors.formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {errors.formError}
        </p>
      ) : null}

      {/* Fixed so Save stays visible; the page reserves the matching bottom space. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-md px-4">
          <Button type="submit" disabled={isPending} className="h-14 w-full text-lg">
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
