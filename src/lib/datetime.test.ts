// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  instantToZoned,
  isValidDateString,
  isValidTimeString,
  nowTimeInTz,
  timeToMinutes,
  todayInTz,
  zonedDateTimeToInstant,
} from "./datetime";

const PARIS = "Europe/Paris";

const iso = (date: Date | null) => date?.toISOString() ?? null;

describe("isValidDateString", () => {
  it.each(["2026-01-01", "2024-02-29", "2026-12-31"])("accepts %s", (value) => {
    expect(isValidDateString(value)).toBe(true);
  });

  it.each(["", "2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "26-01-01", "2026-1-1"])(
    "rejects %j",
    (value) => {
      expect(isValidDateString(value)).toBe(false);
    },
  );
});

describe("isValidTimeString / timeToMinutes", () => {
  it.each(["00:00", "09:05", "23:59"])("accepts %s", (value) => {
    expect(isValidTimeString(value)).toBe(true);
  });

  it.each(["", "24:00", "9:00", "12:60", "12:00:00", "ab:cd"])("rejects %j", (value) => {
    expect(isValidTimeString(value)).toBe(false);
  });

  it("converts to minutes of day", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("23:59")).toBe(1439);
  });
});

describe("zonedDateTimeToInstant", () => {
  it("converts winter (CET, UTC+1) and summer (CEST, UTC+2) times", () => {
    expect(iso(zonedDateTimeToInstant("2026-01-15", "09:30", PARIS))).toBe(
      "2026-01-15T08:30:00.000Z",
    );
    expect(iso(zonedDateTimeToInstant("2026-07-15", "09:30", PARIS))).toBe(
      "2026-07-15T07:30:00.000Z",
    );
  });

  it("handles midnight and 23:59", () => {
    expect(iso(zonedDateTimeToInstant("2026-01-15", "00:00", PARIS))).toBe(
      "2026-01-14T23:00:00.000Z",
    );
    expect(iso(zonedDateTimeToInstant("2026-01-15", "23:59", PARIS))).toBe(
      "2026-01-15T22:59:00.000Z",
    );
    expect(iso(zonedDateTimeToInstant("2026-12-31", "23:59", "UTC"))).toBe(
      "2026-12-31T23:59:00.000Z",
    );
  });

  describe("spring forward (last Sunday of March, 02:00 -> 03:00)", () => {
    it("rejects non-existent local times in the gap", () => {
      expect(zonedDateTimeToInstant("2026-03-29", "02:00", PARIS)).toBeNull();
      expect(zonedDateTimeToInstant("2026-03-29", "02:30", PARIS)).toBeNull();
      expect(zonedDateTimeToInstant("2026-03-29", "02:59", PARIS)).toBeNull();
      expect(zonedDateTimeToInstant("2027-03-28", "02:15", PARIS)).toBeNull();
    });

    it("converts the times around the gap", () => {
      expect(iso(zonedDateTimeToInstant("2026-03-29", "01:59", PARIS))).toBe(
        "2026-03-29T00:59:00.000Z",
      );
      expect(iso(zonedDateTimeToInstant("2026-03-29", "03:00", PARIS))).toBe(
        "2026-03-29T01:00:00.000Z",
      );
      expect(iso(zonedDateTimeToInstant("2026-03-29", "00:00", PARIS))).toBe(
        "2026-03-28T23:00:00.000Z",
      );
      expect(iso(zonedDateTimeToInstant("2026-03-29", "23:59", PARIS))).toBe(
        "2026-03-29T21:59:00.000Z",
      );
    });
  });

  describe("fall back (last Sunday of October, 03:00 -> 02:00)", () => {
    it("resolves ambiguous local times to their first occurrence (CEST)", () => {
      expect(iso(zonedDateTimeToInstant("2026-10-25", "02:00", PARIS))).toBe(
        "2026-10-25T00:00:00.000Z",
      );
      expect(iso(zonedDateTimeToInstant("2026-10-25", "02:30", PARIS))).toBe(
        "2026-10-25T00:30:00.000Z",
      );
      expect(iso(zonedDateTimeToInstant("2027-10-31", "02:59", PARIS))).toBe(
        "2027-10-31T00:59:00.000Z",
      );
    });

    it("converts the unambiguous times around the change", () => {
      expect(iso(zonedDateTimeToInstant("2026-10-25", "01:59", PARIS))).toBe(
        "2026-10-24T23:59:00.000Z",
      );
      expect(iso(zonedDateTimeToInstant("2026-10-25", "03:00", PARIS))).toBe(
        "2026-10-25T02:00:00.000Z",
      );
      expect(iso(zonedDateTimeToInstant("2026-10-25", "23:59", PARIS))).toBe(
        "2026-10-25T22:59:00.000Z",
      );
    });
  });

  it("works for other time zones (negative offsets)", () => {
    expect(iso(zonedDateTimeToInstant("2026-03-08", "02:30", "America/New_York"))).toBeNull();
    expect(iso(zonedDateTimeToInstant("2026-11-01", "01:30", "America/New_York"))).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(iso(zonedDateTimeToInstant("2026-01-15", "23:30", "America/New_York"))).toBe(
      "2026-01-16T04:30:00.000Z",
    );
  });

  it("returns null for malformed input", () => {
    expect(zonedDateTimeToInstant("2026-02-30", "10:00", PARIS)).toBeNull();
    expect(zonedDateTimeToInstant("2026-02-10", "24:00", PARIS)).toBeNull();
    expect(zonedDateTimeToInstant("", "", PARIS)).toBeNull();
  });
});

describe("instantToZoned", () => {
  it("returns date, time and minutes of day in the time zone", () => {
    expect(instantToZoned(new Date("2026-01-15T08:30:00Z"), PARIS)).toEqual({
      date: "2026-01-15",
      time: "09:30",
      minutesOfDay: 570,
    });
  });

  it("renders midnight as 00:00 on the new day", () => {
    expect(instantToZoned(new Date("2026-01-14T23:00:00Z"), PARIS)).toEqual({
      date: "2026-01-15",
      time: "00:00",
      minutesOfDay: 0,
    });
  });

  it("truncates seconds", () => {
    expect(instantToZoned(new Date("2026-01-15T22:59:59.999Z"), PARIS).time).toBe("23:59");
  });

  it("shows both occurrences of the repeated hour on the autumn DST day", () => {
    expect(instantToZoned(new Date("2026-10-25T00:30:00Z"), PARIS).time).toBe("02:30");
    expect(instantToZoned(new Date("2026-10-25T01:30:00Z"), PARIS).time).toBe("02:30");
  });

  it("round-trips with zonedDateTimeToInstant", () => {
    const instant = zonedDateTimeToInstant("2026-03-29", "03:15", PARIS)!;
    expect(instantToZoned(instant, PARIS)).toMatchObject({ date: "2026-03-29", time: "03:15" });
  });
});

describe("todayInTz / nowTimeInTz", () => {
  it("uses the time zone's calendar day, not UTC's", () => {
    const now = new Date("2026-06-30T22:30:00Z");
    expect(todayInTz(now, PARIS)).toBe("2026-07-01");
    expect(nowTimeInTz(now, PARIS)).toBe("00:30");
    expect(todayInTz(now, "UTC")).toBe("2026-06-30");
    expect(nowTimeInTz(now, "UTC")).toBe("22:30");
  });
});
