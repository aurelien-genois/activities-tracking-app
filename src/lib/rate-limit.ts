export const RATE_LIMIT_MESSAGE = "Too many attempts, try again later.";

export interface RateLimiterOptions {
  /** Maximum number of failures allowed inside the window. */
  limit?: number;
  windowMs?: number;
  /** Minimum delay between two sweeps of expired entries. */
  cleanupIntervalMs?: number;
  /** Maximum number of tracked keys; the least recently updated key is evicted beyond it. */
  maxKeys?: number;
  /** Injectable clock (milliseconds), for tests. */
  now?: () => number;
}

export interface RateLimiter {
  isLimited(key: string): boolean;
  recordFailure(key: string): void;
  /** Removes the most recent recorded failure (e.g. a reserved attempt that succeeded). */
  refund(key: string): void;
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
  maxKeys = 10_000,
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

  // Bounds memory: drop expired entries, then the least recently updated keys
  // (Map iteration follows insertion order, refreshed on every update).
  function makeRoomFor(key: string, currentTime: number): void {
    if (failures.has(key) || failures.size < maxKeys) return;
    lastCleanup = currentTime;
    for (const existing of [...failures.keys()]) recent(existing, currentTime);
    for (const oldest of failures.keys()) {
      if (failures.size < maxKeys) break;
      failures.delete(oldest);
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
      const timestamps = recent(key, currentTime);
      makeRoomFor(key, currentTime);
      failures.delete(key);
      failures.set(key, [...timestamps, currentTime]);
    },
    refund(key) {
      const timestamps = failures.get(key);
      if (!timestamps) return;
      if (timestamps.length <= 1) {
        failures.delete(key);
      } else {
        failures.set(key, timestamps.slice(0, -1));
      }
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

export interface LoginRateLimiters {
  /** Failures per IP + email. */
  credentials: RateLimiter;
  /** Failures per IP, whatever the email (stops email spraying from one client). */
  ip: RateLimiter;
  /** Failures across all clients: caps the bcrypt work an attacker can trigger. */
  global: RateLimiter;
}

export const LOGIN_LIMITS = {
  credentials: 5,
  ip: 20,
  global: 100,
} as const;

export function createLoginRateLimiters(
  options: Omit<RateLimiterOptions, "limit"> = {},
): LoginRateLimiters {
  return {
    credentials: createRateLimiter({ ...options, limit: LOGIN_LIMITS.credentials }),
    ip: createRateLimiter({ ...options, limit: LOGIN_LIMITS.ip }),
    global: createRateLimiter({ ...options, limit: LOGIN_LIMITS.global }),
  };
}

const globalForLimiter = globalThis as unknown as { loginRateLimiters?: LoginRateLimiters };

/**
 * Shared login limiters, each over a 15-minute sliding window: 5 failures per
 * IP + email, 20 per IP and 100 overall. Kept on `globalThis` so the Server
 * Action and the Auth.js route handler, bundled separately by Next.js, share
 * one state.
 */
export const loginRateLimiters: LoginRateLimiters = (globalForLimiter.loginRateLimiters ??=
  createLoginRateLimiters());
