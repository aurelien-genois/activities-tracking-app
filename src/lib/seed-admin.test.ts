import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_PASSWORD_HASH_COST,
  type AdminSeedClient,
  readAdminCredentials,
  seedAdmin,
} from "./seed-admin";

function createFakeClient() {
  const users = new Map<string, { id: string; email: string; passwordHash: string }>();
  const upsert = vi.fn<AdminSeedClient["user"]["upsert"]>(async ({ where, update, create }) => {
    const existing = users.get(where.email);
    const user = existing
      ? { ...existing, ...update }
      : { id: `user-${users.size + 1}`, ...create };
    users.set(user.email, user);
    return user;
  });
  return { client: { user: { upsert } } satisfies AdminSeedClient, users, upsert };
}

const env = { ADMIN_EMAIL: "Admin@Example.com ", ADMIN_PASSWORD: "s3cret-password" };

describe("readAdminCredentials", () => {
  it("returns the normalised email and the password", () => {
    expect(readAdminCredentials(env)).toEqual({
      email: "admin@example.com",
      password: "s3cret-password",
    });
  });

  it("fails with a clear message when both variables are missing", () => {
    expect(() => readAdminCredentials({})).toThrow(
      "Missing required environment variable(s): ADMIN_EMAIL, ADMIN_PASSWORD",
    );
  });

  it("fails when only one variable is missing or empty", () => {
    expect(() => readAdminCredentials({ ADMIN_EMAIL: "a@b.c" })).toThrow(
      /variable\(s\): ADMIN_PASSWORD\./,
    );
    expect(() => readAdminCredentials({ ADMIN_EMAIL: "  ", ADMIN_PASSWORD: "x" })).toThrow(
      /variable\(s\): ADMIN_EMAIL\./,
    );
  });
});

describe("seedAdmin", () => {
  it("does not touch the database when env vars are missing", async () => {
    const { client, upsert } = createFakeClient();
    await expect(seedAdmin(client, {})).rejects.toThrow(/ADMIN_EMAIL, ADMIN_PASSWORD/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts on email with a bcrypt hash, never the plain password", async () => {
    const { client, upsert } = createFakeClient();

    const result = await seedAdmin(client, env);

    expect(result).toEqual({ id: "user-1", email: "admin@example.com" });
    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0]![0];
    expect(args.where).toEqual({ email: "admin@example.com" });
    expect(args.create.email).toBe("admin@example.com");
    expect(args.create.passwordHash).toBe(args.update.passwordHash);
    expect(args.create.passwordHash).not.toContain(env.ADMIN_PASSWORD);
    expect(bcrypt.getRounds(args.create.passwordHash)).toBe(ADMIN_PASSWORD_HASH_COST);
    await expect(bcrypt.compare(env.ADMIN_PASSWORD, args.create.passwordHash)).resolves.toBe(true);
  });

  it("is idempotent and rotates the password hash on re-run", async () => {
    const { client, users } = createFakeClient();

    await seedAdmin(client, env);
    const firstHash = users.get("admin@example.com")!.passwordHash;
    await seedAdmin(client, { ...env, ADMIN_PASSWORD: "rotated-password" });

    expect(users.size).toBe(1);
    const user = users.get("admin@example.com")!;
    expect(user.id).toBe("user-1");
    expect(user.passwordHash).not.toBe(firstHash);
    await expect(bcrypt.compare("rotated-password", user.passwordHash)).resolves.toBe(true);
    await expect(bcrypt.compare(env.ADMIN_PASSWORD, user.passwordHash)).resolves.toBe(false);
  });
});
