// @vitest-environment node
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CATEGORIES,
  CATEGORY_KEYS,
  type Category,
  getSubcategories,
  isCategory,
  isSubcategoryOf,
  type Subcategory,
} from "./constants";

describe("CATEGORIES", () => {
  it("matches the specification", () => {
    expect(CATEGORIES).toEqual({
      MANGER: ["Ptit-dej", "Dej", "Gouter", "Dîner"],
      TRAVAIL: ["Job", "Formation", "Création"],
      DOMESTIQUE: ["Administration", "Courses", "Ménage", "Transport"],
      LOISIR: ["Jeu-vidéo", "Lecture", "Sortir", "Écouter", "Sport"],
      REPOS: ["Dormir", "Douche", "Trainer"],
      FAMILLE: ["Téléphone", "Discussion"],
    });
  });

  it("lists the category keys in display order", () => {
    expect(CATEGORY_KEYS).toEqual([
      "MANGER",
      "TRAVAIL",
      "DOMESTIQUE",
      "LOISIR",
      "REPOS",
      "FAMILLE",
    ]);
  });

  it("exposes precise types", () => {
    expectTypeOf<Subcategory<"TRAVAIL">>().toEqualTypeOf<"Job" | "Formation" | "Création">();
    expectTypeOf<Category>().toEqualTypeOf<
      "MANGER" | "TRAVAIL" | "DOMESTIQUE" | "LOISIR" | "REPOS" | "FAMILLE"
    >();
  });
});

describe("isCategory", () => {
  it.each(CATEGORY_KEYS)("accepts %s", (key) => {
    expect(isCategory(key)).toBe(true);
  });

  it.each(["", "manger", "Manger", "toString", "__proto__", undefined, 1])(
    "rejects %j",
    (value) => {
      expect(isCategory(value)).toBe(false);
    },
  );
});

describe("isSubcategoryOf", () => {
  it("accepts subcategories of the category, including accented values", () => {
    expect(isSubcategoryOf("MANGER", "Dîner")).toBe(true);
    expect(isSubcategoryOf("TRAVAIL", "Création")).toBe(true);
    expect(isSubcategoryOf("LOISIR", "Écouter")).toBe(true);
  });

  it("rejects subcategories of another category or unknown values", () => {
    expect(isSubcategoryOf("MANGER", "Job")).toBe(false);
    expect(isSubcategoryOf("MANGER", "diner")).toBe(false);
    expect(isSubcategoryOf("MANGER", undefined)).toBe(false);
  });
});

describe("getSubcategories", () => {
  it("returns the subcategories of a category", () => {
    expect(getSubcategories("FAMILLE")).toEqual(["Téléphone", "Discussion"]);
  });
});
