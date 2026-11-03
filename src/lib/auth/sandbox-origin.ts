import "server-only";

/** Local-only development origin policy. An allowlist is not a production
 * authentication switch and cannot authorize non-loopback hosts.
 */
export function sandboxOrigins(): ReadonlySet<string> | null {
  const primary = process.env.MYSTICWEB_APP_URL;
  if (!primary) return null;
  const raw = [primary, ...(process.env.MYSTICWEB_ALLOWED_ORIGINS?.split(",") ?? [])];
  const origins = new Set<string>();
  for (const entry of raw) {
    const value = entry.trim();
    if (!value || /[\s?#]/.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.origin !== value || url.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
          url.username || url.password) return null;
      origins.add(url.origin);
    } catch { return null; }
  }
  return origins;
}

export function sandboxOriginAllowed(request: Request, mutation: boolean): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const origins = sandboxOrigins();
  if (!origins) return false;
  try {
    const url = new URL(request.url);
    if (!origins.has(url.origin)) return false;
    if (mutation && (request.headers.get("origin") !== url.origin ||
        (request.headers.has("sec-fetch-site") &&
         request.headers.get("sec-fetch-site") !== "same-origin"))) return false;
    return true;
  } catch { return false; }
}
