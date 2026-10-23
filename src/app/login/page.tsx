import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Sign in · Activities Tracking" };

export default async function LoginPage() {
  if (await auth()) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">Activities Tracking</h1>
      <LoginForm />
    </main>
  );
}
