import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Everything except Auth.js endpoints, the health probe, Next internals and
  // static files. `/login` stays matched: the `authorized` callback lets
  // anonymous users through and redirects signed-in users to `/`.
  matcher: [
    "/((?!api/auth/|api/health$|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpe?g|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
