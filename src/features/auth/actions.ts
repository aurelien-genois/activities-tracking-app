"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";

import { RATE_LIMITED_CODE } from "./authorize";
import {
  INVALID_CREDENTIALS_MESSAGE,
  RATE_LIMIT_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
} from "./messages";

export type LoginState = { ok: false; error: string } | null;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: field(formData, "email"),
      password: field(formData, "password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      const message =
        error.code === RATE_LIMITED_CODE ? RATE_LIMIT_MESSAGE : INVALID_CREDENTIALS_MESSAGE;
      return { ok: false, error: message };
    }
    if (error instanceof AuthError) {
      return { ok: false, error: UNEXPECTED_ERROR_MESSAGE };
    }
    throw error;
  }
  redirect("/");
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
