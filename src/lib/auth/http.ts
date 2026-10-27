import "server-only";

const COOKIE = "__Host-mysticweb_session";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const SECONDS = 8 * 60 * 60;

/** Auth mutations require POST and a trusted configured HTTPS origin, never Host
 * or X-Forwarded-Host. Strict Origin validation covers login CSRF as well as logout.
 * Future non-browser clients need a separate authenticated protocol.
 */
export function allowAuthMutation(method: string, headers: Headers, configuredOrigin: string): boolean {
  try {
    const origin = new URL(configuredOrigin);
    return method === "POST" && origin.protocol === "https:" && origin.origin === configuredOrigin &&
      headers.get("origin") === configuredOrigin &&
      (!headers.has("sec-fetch-site") || headers.get("sec-fetch-site") === "same-origin");
  } catch { return false; }
}

export function authCookie(token: string | null) {
  if (token !== null && !TOKEN.test(token)) throw new Error("Invalid session token");
  return {
    name: COOKIE, value: token ?? "",
    httpOnly: true, secure: true, sameSite: "strict" as const,
    path: "/", maxAge: token === null ? 0 : SECONDS,
  };
}
