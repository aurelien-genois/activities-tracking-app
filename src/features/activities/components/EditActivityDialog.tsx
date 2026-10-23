"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Activity } from "@/generated/prisma/client";

import { updateActivity } from "../actions";
import { isCategory } from "../constants";
import { activityToFormTimes, formatTimeRange } from "../time";
import { type ActivityFormErrors, validateActivityForm } from "../validate-form";
import { ActivityFields, type ActivityFieldValues } from "./ActivityFields";

export const UPDATED_MESSAGE = "Activity updated";
export const UPDATE_ERROR_MESSAGE = "The activity could not be updated. Please retry.";

export type EditableActivity = Pick<
  Activity,
  "id" | "startAt" | "endAt" | "category" | "subcategory" | "notes"
>;

const NO_ERRORS: ActivityFormErrors = { fieldErrors: {} };

/** Form values of a stored activity; date and times are derived in `timeZone`. */
export function activityToFieldValues(
  activity: EditableActivity,
  timeZone: string,
): ActivityFieldValues {
  return {
    ...activityToFormTimes(activity, timeZone),
    category: isCategory(activity.category) ? activity.category : "",
    subcategory: activity.subcategory,
    notes: activity.notes ?? "",
  };
}

export type EditActivityDialogProps = {
  activity: EditableActivity;
  timeZone: string;
};

export function EditActivityDialog({ activity, timeZone }: EditActivityDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => activityToFieldValues(activity, timeZone));
  const [errors, setErrors] = useState<ActivityFormErrors>(NO_ERRORS);
  const [isPending, startTransition] = useTransition();
  const summary = `${formatTimeRange(activity, timeZone)}, ${activity.category} > ${activity.subcategory}`;

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (next) {
      // Always start from the stored activity (discard abandoned edits).
      setValues(activityToFieldValues(activity, timeZone));
      setErrors(NO_ERRORS);
    }
    setOpen(next);
  }

  function handleChange(patch: Partial<ActivityFieldValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const fieldErrors = { ...current.fieldErrors };
      for (const key of Object.keys(patch) as (keyof ActivityFieldValues)[]) {
        delete fieldErrors[key];
      }
      return { fieldErrors };
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const checked = validateActivityForm(values, timeZone);
    if (!checked.ok) {
      setErrors({ fieldErrors: checked.fieldErrors, formError: checked.formError });
      return;
    }
    setErrors(NO_ERRORS);

    const submitted = { ...values };
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof updateActivity>>;
      try {
        result = await updateActivity(activity.id, submitted);
      } catch {
        setErrors({ fieldErrors: {}, formError: UPDATE_ERROR_MESSAGE });
        return;
      }
      if (!result.ok) {
        setErrors({ fieldErrors: result.fieldErrors, formError: result.formError });
        return;
      }
      setOpen(false);
      toast.success(UPDATED_MESSAGE);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 min-w-20 text-base"
          aria-label={`Edit ${summary}`}
        >
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] gap-3 overflow-y-auto rounded-lg p-4">
        <DialogHeader className="text-left">
          <DialogTitle>Edit activity</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Edit activity"
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
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 text-base"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-12 text-base" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
