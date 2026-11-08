import "server-only";
import { initializeMysticWebRuntime } from "../storage/runtime";
import { sandboxOriginAllowed } from "./sandbox-origin";
import { AuthStore, rateBucket } from "./store";
import { verifyMysticHandle } from "../mystic/native-user-login";
import { readNativeAccountSnapshot } from "../mystic/native-account-status";
import { resolveLocalRecipient } from "../mystic/mail-recipients";

const COOKIE = "__Host-mysticweb_session";
const headers = { "Cache-Control": "private, no-store" };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
function config() {
  try {
    const runtime = initializeMysticWebRuntime();
    return {
      users: runtime.usersPath,
      db: runtime.databasePath,
      secret: runtime.rateKey,
    };
  } catch (error) {
    console.error("MysticWeb authentication runtime initialization failed:", error);
    return null;
  }
}
function currentToken(request: Request) {
  const values = (request.headers.get("cookie") ?? "").split(";").map(x => x.trim()).filter(x => x.startsWith(COOKIE + "="));
  return values.length === 1 ? values[0].slice(COOKIE.length + 1) : undefined;
}
function sessionCookie(token: string | null) {
  return COOKIE + "=" + (token ?? "") + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + (token ? 28800 : 0);
}
export async function sandboxLogin(request: Request): Promise<Response> {
  const settings = config();
  if (!settings) return reply({ error: "Sandbox sign-in unavailable" }, 503);
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  if (!sandboxOriginAllowed(request, true)) {
    console.warn("MysticWeb login rejected: untrusted request origin");
    return reply({ error: "Forbidden" }, 403);
  }
  try {
    if (request.headers.get("content-type") !== "application/json") return reply({ error: "Invalid request" }, 400);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2048) return reply({ error: "Invalid request" }, 400);
    let input: unknown;
    try { input = JSON.parse(raw); }
    catch { return reply({ error: "Invalid request" }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return reply({ error: "Invalid request" }, 400);
    const value = input as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== "password,username" ||
        typeof value.username !== "string" || typeof value.password !== "string" ||
        !value.username || !value.password || Buffer.byteLength(value.username) > 120 ||
        Buffer.byteLength(value.password) > 256) return reply({ error: "Invalid request" }, 400);
    const store = new AuthStore(settings.db);
    try {
      // Dev-only sandbox rate limit; identity is still verified by native Mystic data.
      const limit = store.consume(rateBucket(settings.secret, "sandbox_login", value.username.toLowerCase()), 5, 60000);
      if (!limit.allowed) return reply({ error: "Sign-in unavailable" }, 429);
      const match = await verifyMysticHandle(settings.users, value.username, value.password);
      if (!match) return reply({ error: "Sign-in unavailable" }, 401);
      const status = await readNativeAccountSnapshot(settings.users, match.userId);
      if (!status || status.locked || status.deletedCandidate || status.passwordChangeRequired)
        return reply({ error: "Sign-in unavailable" }, 401);
      // Sandbox-only: this A48 installation has no separate account-expiration
      // feature. Never use this path to grant message-area or production permissions.
      const token = store.create({ instance: "mystic_native_dev", userId: match.userId }, currentToken(request));
      const result = reply({ ok: true });
      result.headers.set("Set-Cookie", sessionCookie(token));
      return result;
    } finally { store.close(); }
  } catch (error) {
    console.error("MysticWeb login processing failed:", error);
    return reply({ error: "Sandbox sign-in unavailable" }, 503);
  }
}
export async function sandboxLogout(request: Request): Promise<Response> {
  const settings = config();
  if (!settings || request.method !== "POST" || !sandboxOriginAllowed(request, true)) return reply({ error: "Sandbox logout unavailable" }, 503);
  try {
    const store = new AuthStore(settings.db);
    try { store.revoke(currentToken(request)); } finally { store.close(); }
    const result = reply({ ok: true });
    result.headers.set("Set-Cookie", sessionCookie(null));
    return result;
  } catch { return reply({ error: "Sandbox logout unavailable" }, 503); }
}
export async function sandboxSession(request: Request): Promise<Response> {
  const settings = config();
  if (!settings || !sandboxOriginAllowed(request, false)) return reply({ authenticated: false }, 401);
  try {
    const store = new AuthStore(settings.db);
    let identity;
    try { identity = store.read(currentToken(request)); } finally { store.close(); }
    if (!identity || identity.instance !== "mystic_native_dev") return reply({ authenticated: false }, 401);
    const status = await readNativeAccountSnapshot(settings.users, identity.userId);
    if (!status || status.locked || status.deletedCandidate || status.passwordChangeRequired) {
      // A disabled account must not regain a previous session when re-enabled.
      const revokeStore = new AuthStore(settings.db);
      try { revokeStore.revokeIdentity(identity); } finally { revokeStore.close(); }
      const denied = reply({ authenticated: false }, 401);
      denied.headers.set("Set-Cookie", sessionCookie(null));
      return denied;
    }
    const nativeUser = await resolveLocalRecipient(settings.users, identity.userId);
    return reply({ authenticated: true, userId: identity.userId, securityLevel: status.securityLevel,
      handle: nativeUser?.handle ?? null });
  } catch { return reply({ authenticated: false }, 401); }
}
