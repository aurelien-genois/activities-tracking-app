interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Client IP used for rate limiting. `trustedProxyHops` is the number of
 * reverse proxies in front of the app (`TRUST_PROXY_HOPS`) that each append
 * the address they received the request from to `X-Forwarded-For`. Only the
 * entry added by the outermost trusted proxy is used: entries to its left are
 * client-supplied and can be spoofed. With 0 hops (default) proxy headers are
 * ignored and every client shares the "unknown" bucket.
 */
export function getClientIp(headers: HeaderReader, trustedProxyHops: number): string {
  if (trustedProxyHops <= 0) return "unknown";
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  // Fewer entries than trusted hops: the request did not go through every proxy.
  return entries[entries.length - trustedProxyHops] ?? "unknown";
}
