// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ACTIVITY_MESSAGES as M,
  activityFormSchema,
  getFieldErrors,
  historyFilterSchema,
  parseHistoryFilters,
} from "./schema";

const valid = {
  date: "2026-10-20",
  startTime: "09:00",
  endTime: "10:00",
  category: "TRAVAIL",
  subcategory: "Job",
  notes: "Standup",
};

function errorsOf(input: unknown) {
  const result = activityFormSchema.safeParse(input);
  if (result.success) throw new Error("expected a validation failure");
  return getFieldErrors(result.error);
}

describe("activityFormSchema", () => {
  it("accepts a valid activity", () => {
    expect(activityFormSchema.parse(valid)).toEqual(valid);
  });

  it("accepts accented subcategories (and normalises them to NFC)", () => {
    const decomposed = "Di\u0302ner";
    expect(
      activityFormSchema.parse({ ...valid, category: "MANGER", subcategory: decomposed })
        .subcategory,
    ).toBe("Dîner");
    expect(
      activityFormSchema.parse({ ...valid, category: "LOISIR", subcategory: "Écouter" })
        .subcategory,
    ).toBe("Écouter");
  });

  it("reports every missing required field with a clear message", () => {
    expect(errorsOf({})).toEqual({
      date: [M.dateRequired],
      startTime: [M.startTimeRequired],
      endTime: [M.endTimeRequired],
      category: [M.categoryRequired],
      subcategory: [M.subcategoryRequired],
    });
  });

  it("treats empty and blank strings as missing", () => {
    expect(
      errorsOf({ date: "", startTime: " ", endTime: "", category: "", subcategory: "  " }),
    ).toEqual({
      date: [M.dateRequired],
      startTime: [M.startTimeRequired],
      endTime: [M.endTimeRequired],
      category: [M.categoryRequired],
      subcategory: [M.subcategoryRequired],
    });
  });

  it("rejects invalid calendar dates and malformed dates", () => {
    expect(errorsOf({ ...valid, date: "2026-02-30" })).toEqual({ date: [M.dateInvalid] });
    expect(errorsOf({ ...valid, date: "20/10/2026" })).toEqual({ date: [M.dateInvalid] });
  });

  it("rejects malformed times", () => {
    expect(errorsOf({ ...valid, startTime: "9:00", endTime: "25:00" })).toEqual({
      startTime: [M.startTimeInvalid],
      endTime: [M.endTimeInvalid],
    });
  });

  it("requires the end time to be after the start time", () => {
    expect(errorsOf({ ...valid, startTime: "10:00", endTime: "09:59" })).toEqual({
      endTime: [M.endBeforeStart],
    });
    expect(errorsOf({ ...valid, startTime: "10:00", endTime: "10:00" })).toEqual({
      endTime: [M.endBeforeStart],
    });
  });

  it("refuses 00:00 as an end time (cannot cross midnight) and accepts 23:59", () => {
    expect(errorsOf({ ...valid, startTime: "23:00", endTime: "00:00" })).toEqual({
      endTime: [M.crossesMidnight],
    });
    expect(errorsOf({ ...valid, startTime: "00:00", endTime: "00:00" })).toEqual({
      endTime: [M.crossesMidnight],
    });
    expect(
      activityFormSchema.safeParse({ ...valid, startTime: "23:00", endTime: "23:59" }).success,
    ).toBe(true);
    expect(
      activityFormSchema.safeParse({ ...valid, startTime: "00:00", endTime: "00:01" }).success,
    ).toBe(true);
  });

  it("rejects unknown categories", () => {
    expect(errorsOf({ ...valid, category: "Travail" })).toEqual({ category: [M.categoryInvalid] });
  });

  it("requires the subcategory to belong to the selected category", () => {
    expect(errorsOf({ ...valid, category: "MANGER", subcategory: "Job" })).toEqual({
      subcategory: [M.subcategoryMismatch],
    });
    expect(errorsOf({ ...valid, subcategory: "job" })).toEqual({
      subcategory: [M.subcategoryMismatch],
    });
  });

  it("reports cross-field errors together with other field errors", () => {
    expect(
      errorsOf({ ...valid, date: "", subcategory: "Dîner", endTime: "08:00", category: "" }),
    ).toEqual({
      date: [M.dateRequired],
      category: [M.categoryRequired],
      endTime: [M.endBeforeStart],
    });
    expect(
      errorsOf({ ...valid, startTime: "", subcategory: "Dîner", notes: "a".repeat(1001) }),
    ).toEqual({
      startTime: [M.startTimeRequired],
      notes: [M.notesTooLong],
      subcategory: [M.subcategoryMismatch],
    });
  });

  it("makes notes optional, trims them and turns empty notes into undefined", () => {
    const { notes: _notes, ...withoutNotes } = valid;
    expect(activityFormSchema.parse(withoutNotes).notes).toBeUndefined();
    expect(activityFormSchema.parse({ ...valid, notes: "" }).notes).toBeUndefined();
    expect(activityFormSchema.parse({ ...valid, notes: "   " }).notes).toBeUndefined();
    expect(activityFormSchema.parse({ ...valid, notes: "  hi  " }).notes).toBe("hi");
  });

  it("limits notes to 1000 characters", () => {
    expect(activityFormSchema.parse({ ...valid, notes: "a".repeat(1000) }).notes).toHaveLength(
      1000,
    );
    expect(errorsOf({ ...valid, notes: "a".repeat(1001) })).toEqual({ notes: [M.notesTooLong] });
    expect(M.notesTooLong).toBe("Notes must be at most 1000 characters.");
  });

  it("rejects non-object input without throwing", () => {
    expect(activityFormSchema.safeParse(null).success).toBe(false);
    expect(activityFormSchema.safeParse("x").success).toBe(false);
  });
});

describe("parseHistoryFilters", () => {
  it("defaults to page 1 without filters", () => {
    expect(parseHistoryFilters(undefined)).toEqual({
      q: undefined,
      category: undefined,
      subcategory: undefined,
      page: 1,
    });
    expect(parseHistoryFilters(null)).toMatchObject({ page: 1 });
  });

  it("keeps valid filters, trimming the query", () => {
    expect(
      parseHistoryFilters({
        q: "  réunion ",
        category: "TRAVAIL",
        subcategory: "Création",
        page: "3",
      }),
    ).toEqual({ q: "réunion", category: "TRAVAIL", subcategory: "Création", page: 3 });
  });

  it.each([
    ["MANGER", "Dîner"],
    ["TRAVAIL", "Création"],
    ["LOISIR", "Écouter"],
  ])("accepts accented subcategory %s > %s from URL search params", (category, subcategory) => {
    const params = new URLSearchParams();
    params.set("category", category);
    params.set("subcategory", subcategory);
    expect(parseHistoryFilters(new URLSearchParams(params.toString()))).toMatchObject({
      category,
      subcategory,
    });
  });

  it("normalises decomposed accents (NFD) to the stored values", () => {
    expect(
      parseHistoryFilters({ category: "LOISIR", subcategory: "E\u0301couter" }).subcategory,
    ).toBe("Écouter");
  });

  it("drops invalid values instead of throwing", () => {
    expect(
      parseHistoryFilters({
        q: "x".repeat(101),
        category: "NOPE",
        subcategory: "Dîner",
        page: "0",
      }),
    ).toEqual({ q: undefined, category: undefined, subcategory: undefined, page: 1 });
  });

  it("drops a subcategory that does not belong to the category or has no category", () => {
    expect(parseHistoryFilters({ category: "TRAVAIL", subcategory: "Dîner" })).toMatchObject({
      category: "TRAVAIL",
      subcategory: undefined,
    });
    expect(parseHistoryFilters({ subcategory: "Dîner" }).subcategory).toBeUndefined();
  });

  it("drops empty queries and keeps 100-character queries", () => {
    expect(parseHistoryFilters({ q: "   " }).q).toBeUndefined();
    expect(parseHistoryFilters({ q: "x".repeat(100) }).q).toHaveLength(100);
  });

  it.each(["-1", "1.5", "abc", "", "9999999"])("falls back to page 1 for page=%j", (page) => {
    expect(parseHistoryFilters({ page }).page).toBe(1);
  });

  it("uses the first value of repeated params", () => {
    expect(parseHistoryFilters({ page: ["2", "5"], q: ["a", "b"] })).toMatchObject({
      page: 2,
      q: "a",
    });
  });

  it("is exposed as a schema that never throws", () => {
    expect(historyFilterSchema.parse({ page: 4, category: 1 })).toMatchObject({
      page: 1,
      category: undefined,
    });
  });
});
