"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { CATEGORY_KEYS, type Category, getSubcategories } from "../constants";
import { buildHistoryHref, HISTORY_PATH, type HistoryParams, hasActiveFilters } from "../history";
import { HISTORY_QUERY_MAX_LENGTH } from "../schema";

const ALL = "All";

type FilterChipsProps = {
  label: string;
  options: readonly string[];
  value: string | undefined;
  onSelect: (value: string | undefined) => void;
  disabled?: boolean;
};

/** Single-selection chips with an "All" option (no filter). */
function FilterChips({ label, options, value, onSelect, disabled }: FilterChipsProps) {
  const labelId = useId();
  const chip = (option: string, selected: boolean, next: string | undefined) => (
    <button
      key={option}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(next)}
      className={cn(
        "min-h-11 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow"
          : "border-input bg-background hover:bg-accent",
      )}
    >
      {option}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium leading-none">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {chip(ALL, !value, undefined)}
        {options.map((option) => chip(option, option === value, option))}
      </div>
    </div>
  );
}

export type HistoryFiltersProps = {
  /** Validated filters currently applied (from the URL). */
  filters: Omit<HistoryParams, "page">;
};

/**
 * Filters live in the URL: every change navigates to a new `/history` href
 * (page reset to 1). Changing the category resets the subcategory.
 */
export function HistoryFilters({ filters }: HistoryFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");
  const inputId = useId();
  const category = filters.category || undefined;

  function navigate(params: Omit<HistoryParams, "page">) {
    startTransition(() => router.push(buildHistoryHref(params)));
  }

  return (
    <form
      role="search"
      aria-label="Filter activities"
      aria-busy={isPending}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        navigate({ q: query, category, subcategory: filters.subcategory });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>Search notes</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            name="q"
            type="search"
            enterKeyHint="search"
            maxLength={HISTORY_QUERY_MAX_LENGTH}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 text-base"
          />
          <Button type="submit" className="h-11 px-4 text-base" disabled={isPending}>
            Search
          </Button>
        </div>
      </div>

      <FilterChips
        label="Category"
        options={CATEGORY_KEYS}
        value={category}
        disabled={isPending}
        onSelect={(value) => navigate({ q: query, category: value as Category | undefined })}
      />

      {category ? (
        <FilterChips
          label="Subcategory"
          options={getSubcategories(category)}
          value={filters.subcategory}
          disabled={isPending}
          onSelect={(subcategory) => navigate({ q: query, category, subcategory })}
        />
      ) : null}

      {hasActiveFilters(filters) ? (
        <Link
          href={HISTORY_PATH}
          className="self-start py-2 text-sm font-medium underline underline-offset-4"
        >
          Clear filters
        </Link>
      ) : null}
    </form>
  );
}
