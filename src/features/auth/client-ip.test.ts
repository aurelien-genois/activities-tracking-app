import { describe, expect, it } from "vitest";

import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
  it("returns 'unknown' when no proxy hop is trusted", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });
    expect(getClientIp(headers, 0)).toBe("unknown");
  });

  it("uses the entry appended by a single trusted proxy (right-most)", () => {
    const headers = new Headers({ "x-forwarded-for": " 1.2.3.4 , 203.0.113.7 " });
    expect(getClientIp(headers, 1)).toBe("203.0.113.7");
  });

  it("ignores spoofed left-most values", () => {
    const real = "203.0.113.7";
    const keys = ["", "6.6.6.6, ", "1.1.1.1, 2.2.2.2, ", "unknown, "].map((spoofed) =>
      getClientIp(new Headers({ "x-forwarded-for": `${spoofed}${real}` }), 1),
    );
    expect(new Set(keys)).toEqual(new Set([real]));
  });

  it("counts trusted hops from the right", () => {
    const headers = new Headers({
      "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.2",
    });
    expect(getClientIp(headers, 2)).toBe("203.0.113.7");
    expect(getClientIp(headers, 3)).toBe("6.6.6.6");
  });

  it("returns 'unknown' when fewer entries than trusted hops are present", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.7" }), 2)).toBe("unknown");
  });

  it("ignores x-real-ip and returns 'unknown' without x-forwarded-for", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "5.6.7.8" }), 1)).toBe("unknown");
    expect(getClientIp(new Headers({ "x-forwarded-for": " , " }), 1)).toBe("unknown");
    expect(getClientIp(new Headers(), 1)).toBe("unknown");
  });
});
