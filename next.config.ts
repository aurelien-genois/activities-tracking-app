import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Next 16 `next dev` run under an AI agent appends its own block to AGENTS.md.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(isDev) }];
  },
};

export default nextConfig;
