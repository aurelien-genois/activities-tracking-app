import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getEnv, parseEnv, resetEnvCache } from "./env";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/activities",
  AUTH_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("parses a valid environment and applies defaults", () => {
    expect(parseEnv(validEnv)).toEqual({
      ...validEnv,
      AUTH_TRUST_HOST: false,
      TRUST_PROXY_HOPS: 0,
      APP_TIMEZONE: "Europe/Paris",
    });
  });

  it("parses AUTH_TRUST_HOST and a custom time zone", () => {
    const env = parseEnv({ ...validEnv, AUTH_TRUST_HOST: "true", APP_TIMEZONE: "UTC" });
    expect(env.AUTH_TRUST_HOST).toBe(true);
    expect(env.APP_TIMEZONE).toBe("UTC");
  });

  it("treats empty strings as missing", () => {
    expect(parseEnv({ ...validEnv, APP_TIMEZONE: "" }).APP_TIMEZONE).toBe("Europe/Paris");
    expect(() => parseEnv({ ...validEnv, AUTH_SECRET: "" })).toThrow(/AUTH_SECRET/);
  });

  it("rejects missing required variables", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL.*AUTH_SECRET/);
  });

  it("rejects a non-PostgreSQL DATABASE_URL", () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a short AUTH_SECRET", () => {
    expect(() => parseEnv({ ...validEnv, AUTH_SECRET: "short" })).toThrow(
      /AUTH_SECRET: must be at least 32 characters/,
    );
  });

  it("rejects an invalid AUTH_TRUST_HOST", () => {
    expect(() => parseEnv({ ...validEnv, AUTH_TRUST_HOST: "yes" })).toThrow(/AUTH_TRUST_HOST/);
  });

  it("parses TRUST_PROXY_HOPS independently of AUTH_TRUST_HOST", () => {
    expect(parseEnv({ ...validEnv, AUTH_TRUST_HOST: "true" }).TRUST_PROXY_HOPS).toBe(0);
    expect(parseEnv({ ...validEnv, TRUST_PROXY_HOPS: "" }).TRUST_PROXY_HOPS).toBe(0);
    expect(parseEnv({ ...validEnv, TRUST_PROXY_HOPS: "2" }).TRUST_PROXY_HOPS).toBe(2);
  });

  it.each(["-1", "1.5", "yes", "true", "100"])("rejects TRUST_PROXY_HOPS=%s", (value) => {
    expect(() => parseEnv({ ...validEnv, TRUST_PROXY_HOPS: value })).toThrow(
      /TRUST_PROXY_HOPS: must be a non-negative integer/,
    );
  });

  it("rejects an unknown time zone", () => {
    expect(() => parseEnv({ ...validEnv, APP_TIMEZONE: "Mars/Olympus" })).toThrow(
      /APP_TIMEZONE: must be a valid IANA time zone/,
    );
  });
});

describe("getEnv", () => {
  beforeEach(() => {
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("validates process.env lazily and caches the result", () => {
    vi.stubEnv("DATABASE_URL", validEnv.DATABASE_URL);
    vi.stubEnv("AUTH_SECRET", validEnv.AUTH_SECRET);

    const first = getEnv();
    expect(first.DATABASE_URL).toBe(validEnv.DATABASE_URL);

    vi.stubEnv("DATABASE_URL", "");
    expect(getEnv()).toBe(first);
  });

  it("throws when process.env is invalid", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => getEnv()).toThrow(/Invalid environment variables/);
  });
});
