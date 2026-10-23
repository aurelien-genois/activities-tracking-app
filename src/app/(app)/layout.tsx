import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Defence in depth: the middleware already protects these routes.
  if (!(await auth())) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center gap-1 border-b p-2">
        <nav className="flex flex-1 gap-1">
          <Button asChild variant="ghost" className="h-11 px-4 text-base">
            <Link href="/">Home</Link>
          </Button>
          <Button asChild variant="ghost" className="h-11 px-4 text-base">
            <Link href="/history">History</Link>
          </Button>
        </nav>
        <form action={logout}>
          <Button type="submit" variant="outline" className="h-11 px-4 text-base">
            Log out
          </Button>
        </form>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
