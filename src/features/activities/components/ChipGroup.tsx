"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

import type { CategoryStyle } from "../categoryColors";

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
  /** Optional per-option colour; without it (or when it returns undefined) the neutral chip is used. */
  styleFor?: (option: T) => CategoryStyle | undefined;
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
  styleFor,
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
          const style = styleFor?.(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={cn(
                "flex min-h-12 items-center justify-center rounded-md border px-1.5 text-center text-sm font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50",
                style
                  ? [
                      style.chip,
                      !(invalid && !selected) && style.hover,
                      selected && style.selected,
                      selected && "shadow",
                    ]
                  : selected
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
