import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration shared by the middleware and `auth.ts`.
 * Must not import Prisma, bcrypt or any Node-only module.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      if (nextUrl.pathname === "/login") {
        return isLoggedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      }
      // `false` redirects to `pages.signIn`.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
