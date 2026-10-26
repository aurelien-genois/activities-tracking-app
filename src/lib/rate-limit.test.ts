import { describe, expect, it } from "vitest";

import {
  createLoginRateLimiters,
  createRateLimiter,
  LOGIN_LIMITS,
  loginRateLimiters,
  loginRateLimitKey,
} from "./rate-limit";

const MINUTE = 60 * 1000;

function setup() {
  let time = 1_000_000;
  const clock = {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
  const limiter = createRateLimiter({ now: clock.now });
  return { clock, limiter };
}

describe("createRateLimiter", () => {
  it("is not limited below 5 failures", () => {
    const { limiter } = setup();
    for (let i = 0; i < 4; i++) limiter.recordFailure("k");
    expect(limiter.isLimited("k")).toBe(false);
  });

  it("is limited once 5 failures are recorded", () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure("k");
    expect(limiter.isLimited("k")).toBe(true);
  });

  it("lets attempts through again after the 15 minute window", () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure("k");
    clock.advance(15 * MINUTE - 1);
    expect(limiter.isLimited("k")).toBe(true);
    clock.advance(1);
    expect(limiter.isLimited("k")).toBe(false);
  });

  it("uses a sliding window", () => {
    const { clock, limiter } = setup();
    limiter.recordFailure("k");
    clock.advance(10 * MINUTE);
    for (let i = 0; i < 4; i++) limiter.recordFailure("k");
    expect(limiter.isLimited("k")).toBe(true);
    clock.advance(5 * MINUTE);
    // The first failure expired, only 4 remain in the window.
    expect(limiter.isLimited("k")).toBe(false);
  });

  it("resets the key after a successful login", () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure("k");
    limiter.reset("k");
    expect(limiter.isLimited("k")).toBe(false);
    expect(limiter.size()).toBe(0);
  });

  it("isolates keys", () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure("1.1.1.1:a@b.c");
    expect(limiter.isLimited("1.1.1.1:a@b.c")).toBe(true);
    expect(limiter.isLimited("2.2.2.2:a@b.c")).toBe(false);
    expect(limiter.isLimited("1.1.1.1:x@b.c")).toBe(false);
  });

  it("periodically removes expired entries", () => {
    const { clock, limiter } = setup();
    limiter.recordFailure("a");
    limiter.recordFailure("b");
    expect(limiter.size()).toBe(2);
    clock.advance(16 * MINUTE);
    limiter.isLimited("other");
    expect(limiter.size()).toBe(0);
  });

  it("refunds the most recent failure", () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure("k");
    limiter.refund("k");
    expect(limiter.isLimited("k")).toBe(false);
    for (let i = 0; i < 4; i++) limiter.refund("k");
    expect(limiter.size()).toBe(0);
    limiter.refund("missing");
    expect(limiter.size()).toBe(0);
  });

  it("caps the number of keys by evicting the least recently updated one", () => {
    const limiter = createRateLimiter({ maxKeys: 3, now: () => 1_000 });
    limiter.recordFailure("a");
    limiter.recordFailure("b");
    limiter.recordFailure("c");
    limiter.recordFailure("a"); // refreshes "a": "b" becomes the oldest
    limiter.recordFailure("d");
    expect(limiter.size()).toBe(3);
    for (let i = 0; i < 4; i++) limiter.recordFailure("a");
    expect(limiter.isLimited("a")).toBe(true);
    for (let i = 0; i < 100; i++) limiter.recordFailure(`spray-${i}`);
    expect(limiter.size()).toBe(3);
  });

  it("prunes expired entries before evicting live ones", () => {
    const { clock } = setup();
    // No periodic sweep: only the eviction path can prune.
    const limiter = createRateLimiter({ maxKeys: 2, cleanupIntervalMs: Infinity, now: clock.now });
    limiter.recordFailure("expired");
    clock.advance(10 * MINUTE);
    for (let i = 0; i < 5; i++) limiter.recordFailure("live");
    clock.advance(6 * MINUTE); // "expired" left the window, "live" did not
    limiter.recordFailure("new");
    expect(limiter.size()).toBe(2);
    expect(limiter.isLimited("live")).toBe(true);
    limiter.recordFailure("newer"); // nothing expired: evicts "live", the oldest
    expect(limiter.size()).toBe(2);
    expect(limiter.isLimited("live")).toBe(false);
  });

  it("supports custom limits and the default clock", () => {
    const limiter = createRateLimiter({ limit: 1 });
    limiter.recordFailure("k");
    expect(limiter.isLimited("k")).toBe(true);
  });
});

describe("login rate limiting helpers", () => {
  it("builds the key from IP and email", () => {
    expect(loginRateLimitKey("1.2.3.4", "a@b.c")).toBe("1.2.3.4:a@b.c");
  });

  it("creates per IP + email, per IP and global limiters", () => {
    const limiters = createLoginRateLimiters({ now: () => 0 });
    for (const [name, limit] of Object.entries(LOGIN_LIMITS)) {
      const limiter = limiters[name as keyof typeof LOGIN_LIMITS];
      for (let i = 0; i < limit - 1; i++) limiter.recordFailure("k");
      expect(limiter.isLimited("k")).toBe(false);
      limiter.recordFailure("k");
      expect(limiter.isLimited("k")).toBe(true);
    }
  });

  it("exposes limiters shared through globalThis", () => {
    expect(loginRateLimiters.credentials.isLimited("unused")).toBe(false);
    expect((globalThis as { loginRateLimiters?: unknown }).loginRateLimiters).toBe(
      loginRateLimiters,
    );
  });
});
