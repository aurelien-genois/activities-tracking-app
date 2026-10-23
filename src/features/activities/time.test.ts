// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ACTIVITY_MESSAGES as M } from "./schema";
import {
  activityToFormTimes,
  durationMinutes,
  formatDayLabel,
  formatDuration,
  formatTime,
  formatTimeRange,
  getActivityFormDefaults,
  getDefaultStartTime,
  toActivityInterval,
} from "./time";

const PARIS = "Europe/Paris";
const NOW = new Date("2026-10-23T14:30:00Z"); // 16:30 in Paris (CEST)

describe("toActivityInterval", () => {
  it("converts the form date and times to UTC instants in the time zone", () => {
    expect(
      toActivityInterval({ date: "2026-10-23", startTime: "09:00", endTime: "10:15" }, PARIS, NOW),
    ).toEqual({
      ok: true,
      startAt: new Date("2026-10-23T07:00:00Z"),
      endAt: new Date("2026-10-23T08:15:00Z"),
    });
  });

  it("accepts a past day ending at 23:59 and starting at 00:00", () => {
    expect(
      toActivityInterval({ date: "2026-01-10", startTime: "00:00", endTime: "23:59" }, PARIS, NOW),
    ).toEqual({
      ok: true,
      startAt: new Date("2026-01-09T23:00:00Z"),
      endAt: new Date("2026-01-10T22:59:00Z"),
    });
  });

  it("accepts an activity ending exactly now", () => {
    expect(
      toActivityInterval({ date: "2026-10-23", startTime: "16:00", endTime: "16:30" }, PARIS, NOW)
        .ok,
    ).toBe(true);
  });

  it("rejects an activity ending in the future (later today)", () => {
    expect(
      toActivityInterval({ date: "2026-10-23", startTime: "16:00", endTime: "16:31" }, PARIS, NOW),
    ).toEqual({ ok: false, fieldErrors: {}, formError: M.future });
  });

  it("rejects an activity starting in the future", () => {
    expect(
      toActivityInterval({ date: "2026-10-23", startTime: "17:00", endTime: "18:00" }, PARIS, NOW),
    ).toEqual({ ok: false, fieldErrors: {}, formError: M.future });
  });

  it("rejects an activity on a future date", () => {
    expect(
      toActivityInterval({ date: "2026-10-24", startTime: "08:00", endTime: "09:00" }, PARIS, NOW),
    ).toMatchObject({ ok: false, formError: M.future });
  });

  it("uses the time zone's today: 00:30 in Paris is already the next day", () => {
    const now = new Date("2026-06-30T22:45:00Z"); // 2026-07-01 00:45 in Paris
    expect(
      toActivityInterval({ date: "2026-07-01", startTime: "00:00", endTime: "00:30" }, PARIS, now)
        .ok,
    ).toBe(true);
    expect(
      toActivityInterval({ date: "2026-07-01", startTime: "00:00", endTime: "00:30" }, "UTC", now),
    ).toMatchObject({ ok: false, formError: M.future });
  });

  it("rejects non-existent local times on the spring DST day", () => {
    expect(
      toActivityInterval({ date: "2026-03-29", startTime: "02:30", endTime: "03:30" }, PARIS, NOW),
    ).toEqual({ ok: false, fieldErrors: { startTime: [M.startTimeNonexistent] } });
    expect(
      toActivityInterval({ date: "2026-03-29", startTime: "01:30", endTime: "02:15" }, PARIS, NOW),
    ).toEqual({ ok: false, fieldErrors: { endTime: [M.endTimeNonexistent] } });
  });

  it("computes the real elapsed time across the spring DST change", () => {
    const result = toActivityInterval(
      { date: "2026-03-29", startTime: "01:00", endTime: "04:00" },
      PARIS,
      NOW,
    );
    expect(result.ok && durationMinutes(result.startAt, result.endAt)).toBe(120);
  });

  it("resolves the repeated autumn hour to its first occurrence", () => {
    const result = toActivityInterval(
      { date: "2026-10-25", startTime: "01:00", endTime: "04:00" },
      PARIS,
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(result).toEqual({
      ok: true,
      startAt: new Date("2026-10-24T23:00:00Z"),
      endAt: new Date("2026-10-25T03:00:00Z"),
    });
    expect(result.ok && durationMinutes(result.startAt, result.endAt)).toBe(240);

    const ambiguous = toActivityInterval(
      { date: "2026-10-25", startTime: "02:15", endTime: "02:45" },
      PARIS,
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(ambiguous).toEqual({
      ok: true,
      startAt: new Date("2026-10-25T00:15:00Z"),
      endAt: new Date("2026-10-25T00:45:00Z"),
    });
  });

  it("rejects an end that is not after the start (unvalidated input)", () => {
    expect(
      toActivityInterval({ date: "2026-10-20", startTime: "10:00", endTime: "09:00" }, PARIS, NOW),
    ).toEqual({ ok: false, fieldErrors: { endTime: [M.endBeforeStart] } });
  });
});

describe("getDefaultStartTime (validated decision 1)", () => {
  it("uses the current time when there is no activity", () => {
    expect(getDefaultStartTime(null, PARIS, NOW)).toBe("16:30");
    expect(getDefaultStartTime(undefined, PARIS, NOW)).toBe("16:30");
  });

  it("uses the end of the latest activity when it ended today", () => {
    expect(getDefaultStartTime(new Date("2026-10-23T12:45:00Z"), PARIS, NOW)).toBe("14:45");
  });

  it("uses 00:00 when the latest activity ended on a previous day", () => {
    expect(getDefaultStartTime(new Date("2026-10-22T21:59:00Z"), PARIS, NOW)).toBe("00:00");
    expect(getDefaultStartTime(new Date("2026-09-01T10:00:00Z"), PARIS, NOW)).toBe("00:00");
  });

  it("compares days in the time zone, not in UTC", () => {
    // 22:30 UTC on the 22nd is 00:30 on the 23rd in Paris: same day as now.
    expect(getDefaultStartTime(new Date("2026-10-22T22:30:00Z"), PARIS, NOW)).toBe("00:30");
    // 21:59 UTC on the 22nd is 23:59 on the 22nd in Paris: previous day.
    expect(getDefaultStartTime(new Date("2026-10-22T21:59:00Z"), PARIS, NOW)).toBe("00:00");
  });

  it("falls back to the current time if the latest end is on a later day (clock skew)", () => {
    expect(getDefaultStartTime(new Date("2026-10-24T08:00:00Z"), PARIS, NOW)).toBe("16:30");
  });
});

describe("getActivityFormDefaults", () => {
  it("returns today, the default start, now as end and empty selections", () => {
    expect(getActivityFormDefaults(new Date("2026-10-23T12:45:00Z"), PARIS, NOW)).toEqual({
      date: "2026-10-23",
      startTime: "14:45",
      endTime: "16:30",
      category: "",
      subcategory: "",
      notes: "",
    });
    expect(getActivityFormDefaults(null, PARIS, NOW)).toMatchObject({
      startTime: "16:30",
      endTime: "16:30",
    });
  });
});

describe("durations", () => {
  it("computes whole minutes", () => {
    expect(
      durationMinutes(new Date("2026-10-23T07:00:00Z"), new Date("2026-10-23T08:30:00Z")),
    ).toBe(90);
    expect(
      durationMinutes(new Date("2026-10-23T08:00:00Z"), new Date("2026-10-23T07:00:00Z")),
    ).toBe(0);
  });

  it.each([
    [0, "0m"],
    [45, "45m"],
    [60, "1h"],
    [65, "1h 05m"],
    [150, "2h 30m"],
    [1439, "23h 59m"],
  ])("formats %d minutes as %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe("formatting", () => {
  const interval = {
    startAt: new Date("2026-10-23T07:00:00Z"),
    endAt: new Date("2026-10-23T08:05:00Z"),
  };

  it("formats times and ranges in the time zone", () => {
    expect(formatTime(interval.startAt, PARIS)).toBe("09:00");
    expect(formatTimeRange(interval, PARIS)).toBe("09:00 - 10:05");
    expect(formatTimeRange(interval, "UTC")).toBe("07:00 - 08:05");
  });

  it("formats a short day label in the time zone", () => {
    expect(formatDayLabel(new Date("2026-10-22T10:00:00Z"), PARIS)).toBe("Thu 22 Oct");
    // 23:30 UTC is already the next day in Paris.
    expect(formatDayLabel(new Date("2026-10-22T23:30:00Z"), PARIS)).toBe("Fri 23 Oct");
    expect(formatDayLabel(new Date("2026-10-22T23:30:00Z"), "UTC")).toBe("Thu 22 Oct");
  });

  it("derives form date and times from startAt in the time zone", () => {
    expect(
      activityToFormTimes(
        { startAt: new Date("2026-10-22T22:00:00Z"), endAt: new Date("2026-10-22T23:00:00Z") },
        PARIS,
      ),
    ).toEqual({ date: "2026-10-23", startTime: "00:00", endTime: "01:00" });
  });
});
