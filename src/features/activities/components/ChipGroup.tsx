"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

export type ChipGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | "" | undefined;
  onChange: (value: T) => void;
  /** Id of an element describing the group (e.g. its error message). */
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Single-selection group of large toggle chips (`aria-pressed`). */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  describedBy,
  invalid,
  disabled,
  className,
}: ChipGroupProps<T>) {
  const labelId = useId();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span id={labelId} className="text-sm font-medium leading-none">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className="grid grid-cols-3 gap-2"
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={cn(
                "flex min-h-12 items-center justify-center rounded-md border px-1.5 text-center text-sm font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-input bg-background hover:bg-accent",
                invalid && !selected && "border-destructive",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
