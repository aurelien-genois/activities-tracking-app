// @vitest-environment node
import { CredentialsSignin } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLoginRateLimiters,
  type LoginRateLimiters,
  loginRateLimiters,
} from "@/lib/rate-limit";

const { findUnique, compare } = vi.hoisted(() => ({ findUnique: vi.fn(), compare: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
vi.mock("bcryptjs", () => ({ default: { compare } }));

import { authorizeCredentials, RATE_LIMITED_CODE, RateLimitedError } from "./authorize";

const admin = { id: "u1", email: "admin@example.com", passwordHash: "hash" };
const IP = "1.2.3.4";

describe("authorizeCredentials", () => {
  let limiter: LoginRateLimiters;

  beforeEach(() => {
    findUnique.mockReset();
    compare.mockReset();
    limiter = createLoginRateLimiters();
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
    expect(limiter.credentials.isLimited(`${IP}:${admin.email}`)).toBe(true);
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
    for (let i = 0; i < 5; i++) limiter.credentials.recordFailure(`${IP}:${admin.email}`);

    const attempt = authorizeCredentials({ email: admin.email, password: "secret" }, IP, limiter);

    await expect(attempt).rejects.toBeInstanceOf(RateLimitedError);
    await expect(attempt).rejects.toBeInstanceOf(CredentialsSignin);
    await expect(attempt).rejects.toMatchObject({ code: RATE_LIMITED_CODE });
    expect(findUnique).not.toHaveBeenCalled();
    expect(compare).not.toHaveBeenCalled();
  });

  it("resets the limiter after a successful login", async () => {
    for (let i = 0; i < 4; i++) {
      await authorizeCredentials({ email: admin.email, password: "bad" }, IP, limiter);
    }
    findUnique.mockResolvedValue(admin);
    compare.mockResolvedValue(true);

    await authorizeCredentials({ email: admin.email, password: "secret" }, IP, limiter);

    expect(limiter.credentials.size()).toBe(0);
    // Only the successful attempt is refunded from the per-IP and global counts.
    for (let i = 0; i < 15; i++) limiter.ip.recordFailure(IP);
    expect(limiter.ip.isLimited(IP)).toBe(false);
    limiter.ip.recordFailure(IP);
    expect(limiter.ip.isLimited(IP)).toBe(true);
  });

  it("lets at most 5 concurrent attempts reach password verification", async () => {
    findUnique.mockResolvedValue(admin);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    compare.mockImplementation(async () => {
      await gate;
      return false;
    });

    const attempts = Array.from({ length: 20 }, () =>
      authorizeCredentials({ email: admin.email, password: "bad" }, IP, limiter),
    );
    const settled = Promise.allSettled(attempts);
    await vi.waitFor(() => expect(compare).toHaveBeenCalledTimes(5));
    release();
    const results = await settled;

    expect(compare).toHaveBeenCalledTimes(5);
    expect(findUnique).toHaveBeenCalledTimes(5);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(15);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toBeInstanceOf(RateLimitedError);
    }
  });

  it("limits one IP across different emails", async () => {
    findUnique.mockResolvedValue(null);
    compare.mockResolvedValue(false);

    for (let i = 0; i < 20; i++) {
      await authorizeCredentials({ email: `user${i}@example.com`, password: "x" }, IP, limiter);
    }

    await expect(
      authorizeCredentials({ email: admin.email, password: "secret" }, IP, limiter),
    ).rejects.toBeInstanceOf(RateLimitedError);
    expect(compare).toHaveBeenCalledTimes(20);
    // Another IP is not affected.
    await expect(
      authorizeCredentials({ email: admin.email, password: "x" }, "5.6.7.8", limiter),
    ).resolves.toBeNull();
  });

  it("enforces a global failure ceiling before bcrypt", async () => {
    findUnique.mockResolvedValue(null);
    compare.mockResolvedValue(false);

    for (let i = 0; i < 100; i++) {
      const ip = `10.0.${Math.floor(i / 4)}.${i % 4}`;
      await authorizeCredentials({ email: `user${i}@example.com`, password: "x" }, ip, limiter);
    }
    compare.mockClear();
    findUnique.mockClear();

    await expect(
      authorizeCredentials({ email: admin.email, password: "secret" }, "192.0.2.1", limiter),
    ).rejects.toBeInstanceOf(RateLimitedError);
    expect(findUnique).not.toHaveBeenCalled();
    expect(compare).not.toHaveBeenCalled();
  });

  it("does not count rate-limited attempts", async () => {
    for (let i = 0; i < 5; i++) limiter.credentials.recordFailure(`${IP}:${admin.email}`);

    for (let i = 0; i < 30; i++) {
      await expect(
        authorizeCredentials({ email: admin.email, password: "x" }, IP, limiter),
      ).rejects.toBeInstanceOf(RateLimitedError);
    }

    expect(limiter.ip.isLimited(IP)).toBe(false);
    expect(limiter.global.isLimited("global")).toBe(false);
  });

  it("uses the shared limiter by default", async () => {
    findUnique.mockResolvedValue(admin);
    compare.mockResolvedValue(true);
    const reset = vi.spyOn(loginRateLimiters.credentials, "reset");

    await authorizeCredentials({ email: admin.email, password: "secret" }, "9.9.9.9");

    expect(reset).toHaveBeenCalledWith(`9.9.9.9:${admin.email}`);
  });
});
