import bcrypt from "bcryptjs";
import { CredentialsSignin } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { type LoginRateLimiters, loginRateLimiters, loginRateLimitKey } from "@/lib/rate-limit";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(256),
});

/** Valid cost-12 bcrypt hash compared against when the email is unknown. */
const DUMMY_PASSWORD_HASH = "$2b$12$.N3SVxSR0Mg4hQShoals8eHt98MAxOt5zB/COw5snjDeOcV85zs0q";

export const RATE_LIMITED_CODE = "rate_limited";

/** Thrown when too many attempts failed; surfaces as `error.code` in Auth.js. */
export class RateLimitedError extends CredentialsSignin {
  code = RATE_LIMITED_CODE;
}

export interface AuthorizedUser {
  id: string;
  email: string;
}

const GLOBAL_KEY = "global";

/**
 * Checks every login limiter and, only if none is exhausted, records the
 * attempt as a failure in all of them. Fully synchronous, so concurrent
 * requests cannot all pass the check before one of them is counted.
 */
function reserveAttempt(limiters: LoginRateLimiters, ip: string, email: string): boolean {
  const slots = [
    [limiters.credentials, loginRateLimitKey(ip, email)],
    [limiters.ip, ip],
    [limiters.global, GLOBAL_KEY],
  ] as const;
  if (slots.some(([limiter, key]) => limiter.isLimited(key))) return false;
  for (const [limiter, key] of slots) limiter.recordFailure(key);
  return true;
}

/**
 * Verifies login credentials. The attempt is reserved against the rate limits
 * (per IP + email, per IP, global) before any database lookup or password
 * comparison, and refunded on success; every credential failure returns `null`
 * so Auth.js reports one generic `CredentialsSignin` error.
 */
export async function authorizeCredentials(
  input: unknown,
  ip: string,
  limiters: LoginRateLimiters = loginRateLimiters,
): Promise<AuthorizedUser | null> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  if (!reserveAttempt(limiters, ip, email)) {
    throw new RateLimitedError();
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  // Always run one bcrypt comparison to limit timing differences.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  // The reserved attempt stays recorded as a failure.
  if (!user || !passwordMatches) return null;

  limiters.credentials.reset(loginRateLimitKey(ip, email));
  limiters.ip.refund(ip);
  limiters.global.refund(GLOBAL_KEY);
  return { id: user.id, email: user.email };
}
