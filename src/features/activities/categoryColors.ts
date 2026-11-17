import type { Category } from "./constants";

/**
 * Tailwind class strings per category (shared by its subcategories). Every string is a full
 * literal so the Tailwind content scan finds it; never build these by concatenation.
 */
export interface CategoryStyle {
  /** Pastel background, border and dark text. */
  chip: string;
  /** Hover state: border takes the strong colour (no background change). */
  hover: string;
  /** Selected state: colours inverted (background = strong colour, text = pastel). */
  selected: string;
  /** Left accent stripe for list rows. */
  stripe: string;
}

export const CATEGORY_STYLE: Record<Category, CategoryStyle> = {
  MANGER: {
    chip: "bg-category-manger-bg border-category-manger-border text-category-manger-fg",
    hover: "hover:border-category-manger-fg",
    selected: "bg-category-manger-fg text-category-manger-bg border-category-manger-fg",
    stripe: "border-l-4 border-l-category-manger-border",
  },
  TRAVAIL: {
    chip: "bg-category-travail-bg border-category-travail-border text-category-travail-fg",
    hover: "hover:border-category-travail-fg",
    selected: "bg-category-travail-fg text-category-travail-bg border-category-travail-fg",
    stripe: "border-l-4 border-l-category-travail-border",
  },
  DOMESTIQUE: {
    chip: "bg-category-domestique-bg border-category-domestique-border text-category-domestique-fg",
    hover: "hover:border-category-domestique-fg",
    selected: "bg-category-domestique-fg text-category-domestique-bg border-category-domestique-fg",
    stripe: "border-l-4 border-l-category-domestique-border",
  },
  LOISIR: {
    chip: "bg-category-loisir-bg border-category-loisir-border text-category-loisir-fg",
    hover: "hover:border-category-loisir-fg",
    selected: "bg-category-loisir-fg text-category-loisir-bg border-category-loisir-fg",
    stripe: "border-l-4 border-l-category-loisir-border",
  },
  REPOS: {
    chip: "bg-category-repos-bg border-category-repos-border text-category-repos-fg",
    hover: "hover:border-category-repos-fg",
    selected: "bg-category-repos-fg text-category-repos-bg border-category-repos-fg",
    stripe: "border-l-4 border-l-category-repos-border",
  },
  FAMILLE: {
    chip: "bg-category-famille-bg border-category-famille-border text-category-famille-fg",
    hover: "hover:border-category-famille-fg",
    selected: "bg-category-famille-fg text-category-famille-bg border-category-famille-fg",
    stripe: "border-l-4 border-l-category-famille-border",
  },
};
