import { describe, expect, it } from "vitest";

import { ACTIVITY_MESSAGES } from "./schema";
import { validateActivityForm } from "./validate-form";

const TZ = "Europe/Paris";
const NOW = new Date("2026-10-23T14:30:00Z");
const valid = {
  date: "2026-10-23",
  startTime: "09:00",
  endTime: "10:00",
  category: "TRAVAIL",
  subcategory: "Création",
  notes: "",
};

describe("validateActivityForm", () => {
  it("returns parsed data for valid values", () => {
    const result = validateActivityForm(valid, TZ, NOW);
    expect(result).toEqual({ ok: true, data: { ...valid, notes: undefined } });
  });

  it("returns field errors from the schema", () => {
    const result = validateActivityForm({ ...valid, date: "", endTime: "08:00" }, TZ, NOW);
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        date: [ACTIVITY_MESSAGES.dateRequired],
        endTime: [ACTIVITY_MESSAGES.endBeforeStart],
      },
    });
  });

  it("rejects activities in the future", () => {
    const result = validateActivityForm(
      { ...valid, startTime: "16:00", endTime: "17:00" },
      TZ,
      NOW,
    );
    expect(result).toEqual({ ok: false, fieldErrors: {}, formError: ACTIVITY_MESSAGES.future });
  });

  it("reports a root error for non-object input", () => {
    const result = validateActivityForm(null, TZ, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBeTruthy();
  });
});
