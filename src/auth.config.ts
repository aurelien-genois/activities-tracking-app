import type { NextAuthConfig } from "next-auth";

/**
 * Auth.js configuration shared by the proxy (Node.js runtime since Next 16)
 * and `auth.ts`. Kept free of Prisma and bcrypt so the proxy stays light;
 * credentials live in `auth.ts`.
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
