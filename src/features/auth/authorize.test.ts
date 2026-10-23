// @vitest-environment node
import { CredentialsSignin } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter, loginRateLimiter, type RateLimiter } from "@/lib/rate-limit";

const { findUnique, compare } = vi.hoisted(() => ({ findUnique: vi.fn(), compare: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
vi.mock("bcryptjs", () => ({ default: { compare } }));

import { authorizeCredentials, RATE_LIMITED_CODE, RateLimitedError } from "./authorize";

const admin = { id: "u1", email: "admin@example.com", passwordHash: "hash" };
const IP = "1.2.3.4";

describe("authorizeCredentials", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    findUnique.mockReset();
    compare.mockReset();
    limiter = createRateLimiter();
  });

  it("returns the user for valid credentials and normalises the email", async () => {
    findUnique.mockResolvedValue(admin);
    compare.mockResolvedValue(true);

    const user = await authorizeCredentials(
      { email: "  Admin@Example.COM ", password: "secret" },
      IP,
      limiter,
    );

    expect(user).toEqual({ id: "u1", email: "admin@example.com" });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "admin@example.com" } }),
    );
    expect(compare).toHaveBeenCalledWith("secret", "hash");
  });

  it("returns null and records a failure for a wrong password", async () => {
    findUnique.mockResolvedValue(admin);
    compare.mockResolvedValue(false);

    await expect(
      authorizeCredentials({ email: admin.email, password: "bad" }, IP, limiter),
    ).resolves.toBeNull();
    for (let i = 0; i < 4; i++) {
      await authorizeCredentials({ email: admin.email, password: "bad" }, IP, limiter);
    }
    expect(limiter.isLimited(`${IP}:${admin.email}`)).toBe(true);
  });

  it("returns null for an unknown email after a dummy comparison", async () => {
    findUnique.mockResolvedValue(null);
    compare.mockResolvedValue(false);

    await expect(
      authorizeCredentials({ email: "nobody@example.com", password: "x" }, IP, limiter),
    ).resolves.toBeNull();
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0]![1]).toMatch(/^\$2[aby]\$12\$/);
  });

  it("rejects invalid input without touching the database", async () => {
    await expect(
      authorizeCredentials({ email: "", password: "" }, IP, limiter),
    ).resolves.toBeNull();
    await expect(authorizeCredentials(undefined, IP, limiter)).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("throws a rate-limit error before checking the password", async () => {
    for (let i = 0; i < 5; i++) limiter.recordFailure(`${IP}:${admin.email}`);

    const attempt = authorizeCredentials({ email: admin.email, password: "secret" }, IP, limiter);

    await expect(attempt).rejects.toBeInstanceOf(RateLimitedError);
    await expect(attempt).rejects.toBeInstanceOf(CredentialsSignin);
    await expect(attempt).rejects.toMatchObject({ code: RATE_LIMITED_CODE });
    expect(findUnique).not.toHaveBeenCalled();
    expect(compare).not.toHaveBeenCalled();
  });

  it("resets the limiter after a successful login", async () => {
    for (let i = 0; i < 4; i++) limiter.recordFailure(`${IP}:${admin.email}`);
    findUnique.mockResolvedValue(admin);
    compare.mockResolvedValue(true);

    await authorizeCredentials({ email: admin.email, password: "secret" }, IP, limiter);

    expect(limiter.size()).toBe(0);
  });

  it("uses the shared limiter by default", async () => {
    findUnique.mockResolvedValue(admin);
    compare.mockResolvedValue(true);
    const reset = vi.spyOn(loginRateLimiter, "reset");

    await authorizeCredentials({ email: admin.email, password: "secret" }, "9.9.9.9");

    expect(reset).toHaveBeenCalledWith(`9.9.9.9:${admin.email}`);
  });
});
