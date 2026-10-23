import { describe, expect, it } from "vitest";

import { createRateLimiter, loginRateLimitKey, loginRateLimiter } from "./rate-limit";

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

  it("exposes a limiter shared through globalThis", () => {
    expect(loginRateLimiter.isLimited("unused")).toBe(false);
    expect((globalThis as { loginRateLimiter?: unknown }).loginRateLimiter).toBe(loginRateLimiter);
  });
});
