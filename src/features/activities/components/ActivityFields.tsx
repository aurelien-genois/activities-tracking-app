"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { type Category } from "../constants";
import { type ActivityField, type ActivityFieldErrors, NOTES_MAX_LENGTH } from "../schema";
import { CategoryChips, SubcategoryChips } from "./CategoryChips";

export type ActivityFieldValues = {
  date: string;
  startTime: string;
  endTime: string;
  category: Category | "";
  subcategory: string;
  notes: string;
};

export type ActivityFieldsProps = {
  values: ActivityFieldValues;
  errors?: ActivityFieldErrors;
  onChange: (patch: Partial<ActivityFieldValues>) => void;
  disabled?: boolean;
};

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="text-sm font-medium text-destructive">
      {messages[0]}
    </p>
  );
}

/**
 * Controlled activity fields (date, times, category/subcategory chips, note),
 * shared by the entry form and the edit dialog.
 */
export function ActivityFields({ values, errors = {}, onChange, disabled }: ActivityFieldsProps) {
  const baseId = useId();
  const id = (field: ActivityField) => `${baseId}-${field}`;
  const errorId = (field: ActivityField) => `${baseId}-${field}-error`;
  const a11y = (field: ActivityField) =>
    errors[field]?.length
      ? { "aria-invalid": true as const, "aria-describedby": errorId(field) }
      : {};

  const timeInput = (field: "date" | "startTime" | "endTime", label: string, type: string) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id(field)}>{label}</Label>
      <Input
        id={id(field)}
        name={field}
        type={type}
        required
        disabled={disabled}
        value={values[field]}
        onChange={(event) => onChange({ [field]: event.target.value })}
        className="h-12 px-2 text-base aria-[invalid=true]:border-destructive"
        {...a11y(field)}
      />
      <FieldError id={errorId(field)} messages={errors[field]} />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
        {timeInput("date", "Date", "date")}
        {timeInput("startTime", "Start Time", "time")}
        {timeInput("endTime", "End Time", "time")}
      </div>

      <div className="flex flex-col gap-1.5">
        <CategoryChips
          value={values.category}
          onChange={(category) => {
            if (category !== values.category) onChange({ category, subcategory: "" });
          }}
          disabled={disabled}
          invalid={Boolean(errors.category?.length)}
          describedBy={errors.category?.length ? errorId("category") : undefined}
        />
        <FieldError id={errorId("category")} messages={errors.category} />
      </div>

      <div className="flex flex-col gap-1.5">
        <SubcategoryChips
          category={values.category}
          value={values.subcategory}
          onChange={(subcategory) => onChange({ subcategory })}
          disabled={disabled}
          invalid={Boolean(errors.subcategory?.length)}
          describedBy={errors.subcategory?.length ? errorId("subcategory") : undefined}
        />
        <FieldError id={errorId("subcategory")} messages={errors.subcategory} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={id("notes")} className="text-xs font-normal text-muted-foreground">
          Optional note
        </Label>
        <Textarea
          id={id("notes")}
          name="notes"
          rows={1}
          maxLength={NOTES_MAX_LENGTH}
          disabled={disabled}
          value={values.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          className="min-h-11 resize-y border-dashed shadow-none aria-[invalid=true]:border-destructive"
          {...a11y("notes")}
        />
        <FieldError id={errorId("notes")} messages={errors.notes} />
      </div>
    </div>
  );
}
