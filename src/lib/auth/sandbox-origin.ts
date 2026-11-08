import "server-only";

/** Exact-origin policy for local development or explicitly opted-in HTTPS native login.
 * The HTTPS option is separate from the production WebAccess/ACS authorization boundary.
 */
export function sandboxOrigins(): ReadonlySet<string> | null {
  const primary = process.env.MYSTICWEB_APP_URL;
  if (!primary) return null;
  const primaryUrl = new URL(primary);
  const alternate = primaryUrl.protocol === "https:" &&
    (primaryUrl.hostname === "davesbbs.com" || primaryUrl.hostname === "www.davesbbs.com")
    ? `https://${primaryUrl.hostname === "davesbbs.com" ? "www.davesbbs.com" : "davesbbs.com"}` : null;
  const raw = [primary, ...(alternate ? [alternate] : []), ...(process.env.MYSTICWEB_ALLOWED_ORIGINS?.split(",") ?? [])];
  const origins = new Set<string>();
  for (const entry of raw) {
    const value = entry.trim();
    if (!value || /[\s?#]/.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.origin !== value || !((url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) ||
            url.protocol === "https:") ||
          url.username || url.password) return null;
      origins.add(url.origin);
    } catch { return null; }
  }
  return origins;
}

export function sandboxOriginAllowed(request: Request, mutation: boolean): boolean {
  const origins = sandboxOrigins();
  if (!origins) return false;
  try {
    // Next.js may expose its internal listener URL (127.0.0.1:3100)
    // behind nginx. Never compare that internal URL to the public origin.
    // For mutations, require the browser-supplied Origin to be explicitly
    // trusted, plus the Fetch Metadata same-origin signal when present.
    if (mutation) {
      const origin = request.headers.get("origin");
      if (!origin || !origins.has(origin)) return false;
      if (request.headers.has("sec-fetch-site") &&
          request.headers.get("sec-fetch-site") !== "same-origin") return false;
      return true;
    }
    // Session reads do not carry Origin in normal browser navigation.
    // Their session cookie is independently authenticated by the handler.
    const origin = request.headers.get("origin");
    return origin === null || origins.has(origin);
  } catch {
    return false;
  }
}
