import bcrypt from "bcryptjs";
import { CredentialsSignin } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { loginRateLimiter, loginRateLimitKey, type RateLimiter } from "@/lib/rate-limit";

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

/**
 * Verifies login credentials. The rate limit is checked before any password
 * comparison; every credential failure returns `null` so Auth.js reports one
 * generic `CredentialsSignin` error.
 */
export async function authorizeCredentials(
  input: unknown,
  ip: string,
  limiter: RateLimiter = loginRateLimiter,
): Promise<AuthorizedUser | null> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  const key = loginRateLimitKey(ip, email);
  if (limiter.isLimited(key)) {
    throw new RateLimitedError();
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  // Always run one bcrypt comparison to limit timing differences.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    limiter.recordFailure(key);
    return null;
  }

  limiter.reset(key);
  return { id: user.id, email: user.email };
}
