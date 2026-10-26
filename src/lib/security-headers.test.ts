import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, securityHeaders } from "./security-headers";

function asRecord(isDev: boolean): Record<string, string> {
  return Object.fromEntries(securityHeaders(isDev).map(({ key, value }) => [key, value]));
}

describe("contentSecurityPolicy", () => {
  it("is strict in production", () => {
    const csp = contentSecurityPolicy(false);
    for (const directive of [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline';",
      "connect-src 'self';",
      "upgrade-insecure-requests",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("ws:");
  });

  it("allows eval and WebSockets for the development server only", () => {
    const csp = contentSecurityPolicy(true);
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("securityHeaders", () => {
  it("sends the hardening headers with HSTS in production", () => {
    expect(asRecord(false)).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });
  });

  it("omits HSTS in development", () => {
    const headers = asRecord(true);
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});
