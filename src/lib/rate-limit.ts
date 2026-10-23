export const RATE_LIMIT_MESSAGE = "Too many attempts, try again later.";

export interface RateLimiterOptions {
  /** Maximum number of failures allowed inside the window. */
  limit?: number;
  windowMs?: number;
  /** Minimum delay between two sweeps of expired entries. */
  cleanupIntervalMs?: number;
  /** Injectable clock (milliseconds), for tests. */
  now?: () => number;
}

export interface RateLimiter {
  isLimited(key: string): boolean;
  recordFailure(key: string): void;
  reset(key: string): void;
  /** Number of keys currently tracked (exposed for tests). */
  size(): number;
}

/**
 * In-memory sliding-window limiter of failed attempts. State is per process
 * and lost on restart (accepted for a single-instance, single-user app).
 */
export function createRateLimiter({
  limit = 5,
  windowMs = 15 * 60 * 1000,
  cleanupIntervalMs = 60 * 1000,
  now = Date.now,
}: RateLimiterOptions = {}): RateLimiter {
  const failures = new Map<string, number[]>();
  let lastCleanup = now();

  function recent(key: string, currentTime: number): number[] {
    const timestamps = (failures.get(key) ?? []).filter((t) => currentTime - t < windowMs);
    if (timestamps.length === 0) {
      failures.delete(key);
    } else {
      failures.set(key, timestamps);
    }
    return timestamps;
  }

  // Lazy periodic sweep (no timer to keep alive or clean up).
  function cleanupIfDue(currentTime: number): void {
    if (currentTime - lastCleanup < cleanupIntervalMs) return;
    lastCleanup = currentTime;
    for (const key of [...failures.keys()]) {
      recent(key, currentTime);
    }
  }

  return {
    isLimited(key) {
      const currentTime = now();
      cleanupIfDue(currentTime);
      return recent(key, currentTime).length >= limit;
    },
    recordFailure(key) {
      const currentTime = now();
      cleanupIfDue(currentTime);
      failures.set(key, [...recent(key, currentTime), currentTime]);
    },
    reset(key) {
      failures.delete(key);
    },
    size() {
      return failures.size;
    },
  };
}

export function loginRateLimitKey(ip: string, email: string): string {
  return `${ip}:${email}`;
}

const globalForLimiter = globalThis as unknown as { loginRateLimiter?: RateLimiter };

/**
 * Shared limiter for login attempts: 5 failures per 15 minutes per IP + email.
 * Kept on `globalThis` so the Server Action and the Auth.js route handler,
 * bundled separately by Next.js, share one state.
 */
export const loginRateLimiter: RateLimiter = (globalForLimiter.loginRateLimiter ??=
  createRateLimiter());
