import { describe, expect, it } from "vitest";

import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
  it("returns 'unknown' when proxy headers are not trusted", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });
    expect(getClientIp(headers, false)).toBe("unknown");
  });

  it("uses the first x-forwarded-for value", () => {
    const headers = new Headers({
      "x-forwarded-for": " 1.2.3.4 , 10.0.0.1",
      "x-real-ip": "5.6.7.8",
    });
    expect(getClientIp(headers, true)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "5.6.7.8" }), true)).toBe("5.6.7.8");
  });

  it("returns 'unknown' without proxy headers", () => {
    expect(getClientIp(new Headers(), true)).toBe("unknown");
  });
});
