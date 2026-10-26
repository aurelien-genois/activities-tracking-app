import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { authorizeCredentials } from "@/features/auth/authorize";
import { getClientIp } from "@/features/auth/client-ip";
import { getEnv } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // `request` carries the original headers, both for the login Server
      // Action and for direct POSTs to /api/auth/callback/credentials.
      authorize: (credentials, request) =>
        authorizeCredentials(credentials, getClientIp(request.headers, getEnv().TRUST_PROXY_HOPS)),
    }),
  ],
});
