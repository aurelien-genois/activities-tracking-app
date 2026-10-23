"use client";

import { CATEGORY_KEYS, type Category, getSubcategories } from "../constants";
import { ChipGroup } from "./ChipGroup";

type CommonProps = {
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
};

export function CategoryChips({
  value,
  onChange,
  ...props
}: CommonProps & { value: Category | ""; onChange: (value: Category) => void }) {
  return (
    <ChipGroup
      label="Category"
      options={CATEGORY_KEYS}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
}

/** Subcategories of `category` only; a hint is shown until a category is selected. */
export function SubcategoryChips({
  category,
  value,
  onChange,
  ...props
}: CommonProps & {
  category: Category | "";
  value: string;
  onChange: (value: string) => void;
}) {
  if (!category) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium leading-none">Subcategory</span>
        <p className="flex min-h-12 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
          Select a category first.
        </p>
      </div>
    );
  }
  return (
    <ChipGroup
      label="Subcategory"
      options={getSubcategories(category) as readonly string[]}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
}
