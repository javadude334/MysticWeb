import "server-only";
import { initializeMysticWebRuntime } from "../storage/runtime";
import { sandboxOriginAllowed } from "./sandbox-origin";
import { AuthStore, rateBucket } from "./store";
import { verifyMysticHandle } from "../mystic/native-user-login";
import { readNativeAccountSnapshot } from "../mystic/native-account-status";

const COOKIE = "__Host-mysticweb_session";
const headers = { "Cache-Control": "private, no-store" };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
const allowed = () => process.env.NODE_ENV === "development";
function config() {
  if (!allowed()) return null;
  try {
    const runtime = initializeMysticWebRuntime({ privateLocalDataVerified: true });
    return {
      users: runtime.directories.dataDir + "\\users.dat",
      db: runtime.directories.databasePath,
      secret: runtime.rateKey,
    };
  } catch { return null; }
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
  if (!settings || request.method !== "POST" || !sandboxOriginAllowed(request, true)) return reply({ error: "Sandbox sign-in unavailable" }, 503);
  try {
    if (request.headers.get("content-type") !== "application/json") return reply({ error: "Invalid request" }, 400);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2048) return reply({ error: "Invalid request" }, 400);
    const input: unknown = JSON.parse(raw);
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
      const token = store.create({ instance: "mystic_sandbox", userId: match.userId }, currentToken(request));
      const result = reply({ ok: true });
      result.headers.set("Set-Cookie", sessionCookie(token));
      return result;
    } finally { store.close(); }
  } catch { return reply({ error: "Sandbox sign-in unavailable" }, 503); }
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
    if (!identity || identity.instance !== "mystic_sandbox") return reply({ authenticated: false }, 401);
    const status = await readNativeAccountSnapshot(settings.users, identity.userId);
    if (!status || status.locked || status.deletedCandidate || status.passwordChangeRequired) {
      // A disabled account must not regain a previous session when re-enabled.
      const revokeStore = new AuthStore(settings.db);
      try { revokeStore.revokeIdentity(identity); } finally { revokeStore.close(); }
      const denied = reply({ authenticated: false }, 401);
      denied.headers.set("Set-Cookie", sessionCookie(null));
      return denied;
    }
    return reply({ authenticated: true, userId: identity.userId, securityLevel: status.securityLevel });
  } catch { return reply({ authenticated: false }, 401); }
}
