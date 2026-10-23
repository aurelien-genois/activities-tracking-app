interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Client IP used for rate limiting. Proxy headers are only trusted when the
 * app runs behind a trusted reverse proxy (`AUTH_TRUST_HOST`), otherwise they
 * could be spoofed freely, so every client shares the "unknown" bucket.
 */
export function getClientIp(headers: HeaderReader, trustProxy: boolean): string {
  if (!trustProxy) return "unknown";
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}
