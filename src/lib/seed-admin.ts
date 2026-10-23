import bcrypt from "bcryptjs";

export const ADMIN_PASSWORD_HASH_COST = 12;

/** Minimal structural view of the Prisma client used by the seed. */
export interface AdminSeedClient {
  user: {
    upsert(args: {
      where: { email: string };
      update: { passwordHash: string };
      create: { email: string; passwordHash: string };
    }): Promise<{ id: string; email: string }>;
  };
}

type EnvSource = Record<string, string | undefined>;

export interface AdminCredentials {
  email: string;
  password: string;
}

export function readAdminCredentials(env: EnvSource): AdminCredentials {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = env.ADMIN_PASSWORD ?? "";
  const missing = [!email && "ADMIN_EMAIL", !password && "ADMIN_PASSWORD"].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Set them (e.g. in .env) before running the seed.",
    );
  }
  return { email, password };
}

/**
 * Creates the administrator account, or rotates its password hash when it
 * already exists (idempotent upsert keyed on email).
 */
export async function seedAdmin(
  client: AdminSeedClient,
  env: EnvSource,
): Promise<{ id: string; email: string }> {
  const { email, password } = readAdminCredentials(env);
  const passwordHash = await bcrypt.hash(password, ADMIN_PASSWORD_HASH_COST);
  const user = await client.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
  return { id: user.id, email: user.email };
}
