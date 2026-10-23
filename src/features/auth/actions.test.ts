// @vitest-environment node
import { AuthError, CredentialsSignin } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signIn, signOut, redirect } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/auth", () => ({ signIn, signOut }));
vi.mock("next/navigation", () => ({ redirect }));

import { login, logout } from "./actions";
import { RateLimitedError } from "./authorize";
import {
  INVALID_CREDENTIALS_MESSAGE,
  RATE_LIMIT_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
} from "./messages";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("login", () => {
  beforeEach(() => {
    signIn.mockReset();
    redirect.mockClear();
  });

  it("signs in without Auth.js redirect then redirects home", async () => {
    signIn.mockResolvedValue("/");

    await expect(login(null, form({ email: "a@b.c", password: "pw" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "a@b.c",
      password: "pw",
      redirect: false,
    });
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("returns the generic message for invalid credentials", async () => {
    signIn.mockRejectedValue(new CredentialsSignin());

    await expect(login(null, form({}))).resolves.toEqual({
      ok: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "",
      password: "",
      redirect: false,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns the rate-limit message when too many attempts failed", async () => {
    signIn.mockRejectedValue(new RateLimitedError());

    await expect(login(null, form({ email: "a@b.c", password: "pw" }))).resolves.toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
  });

  it("returns a generic error for other Auth.js errors", async () => {
    signIn.mockRejectedValue(new AuthError("db down"));

    await expect(login(null, form({ email: "a@b.c", password: "pw" }))).resolves.toEqual({
      ok: false,
      error: UNEXPECTED_ERROR_MESSAGE,
    });
  });

  it("rethrows unexpected errors", async () => {
    signIn.mockRejectedValue(new Error("boom"));

    await expect(login(null, form({ email: "a@b.c", password: "pw" }))).rejects.toThrow("boom");
  });
});

describe("logout", () => {
  it("signs out and redirects to the login page", async () => {
    await logout();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
