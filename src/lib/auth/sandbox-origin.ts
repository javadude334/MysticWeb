import "server-only";

/** Exact-origin policy for local development or explicitly opted-in HTTPS native login.
 * The HTTPS option is separate from the production WebAccess/ACS authorization boundary.
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
      if (url.origin !== value || !((url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) ||
            (url.protocol === "https:" && process.env.MYSTICWEB_ENABLE_NATIVE_LOGIN === "1")) ||
          url.username || url.password) return null;
      origins.add(url.origin);
    } catch { return null; }
  }
  return origins;
}

export function sandboxOriginAllowed(request: Request, mutation: boolean): boolean {
  if (process.env.NODE_ENV !== "development" && process.env.MYSTICWEB_ENABLE_NATIVE_LOGIN !== "1") return false;
  const origins = sandboxOrigins();
  if (!origins) return false;
  try {
    const url = new URL(request.url);
    const deployed = process.env.NODE_ENV !== "development";
    const expected = deployed ? process.env.MYSTICWEB_APP_URL : url.origin;
    if (!expected || !origins.has(expected) || (!deployed && !origins.has(url.origin))) return false;
    if (mutation && (request.headers.get("origin") !== expected ||
        (request.headers.has("sec-fetch-site") &&
         request.headers.get("sec-fetch-site") !== "same-origin"))) return false;
    return true;
  } catch { return false; }
}
