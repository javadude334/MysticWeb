import "server-only";
import { randomBytes } from "node:crypto";
import { NativeAccess } from "./native";
import { MessageReader, numericId } from "../mystic/reader";

const ORIGIN = "http://127.0.0.1:3000";
const COOKIE = "mysticweb_demo";
const revision = "d".repeat(64);
const sessions = new Map<string, { userId: number; expires: number }>();
const accounts = [{ userId: 42, name: "Alice" }, { userId: 73, name: "Bob" }];
const areas = [{ id: 1, name: "Welcome board", jamBase: "welcome" }, { id: 2, name: "Alice's workshop", jamBase: "workshop" }];

export function developmentEnabled() {
  return process.env.NODE_ENV === "development" && process.env.MYSTICWEB_DEMO === "1";
}

// Synthetic provider only: no native files, passwords, transport or BBS context.
const native = new NativeAccess({ request: async req => {
  if (req.operation === "authenticate" || !accounts.some(a => a.userId === req.userId)) return null;
  return { version: 1, nonce: req.nonce, operation: req.operation, instance: "demo", userId: req.userId,
    account: { exists: true, deleted: false, locked: false, expired: false, passwordChangeRequired: false },
    ...(req.operation === "authorize" ? { areaId: req.areaId, catalogRevision: revision,
      permissions: { list: req.areaId === 1 || req.userId === 42, read: req.areaId === 1 || req.userId === 42,
        group: true, context: true, kind: "echo", private: false, personal: false } } : {}) };
} }, "demo");
const reader = new MessageReader(native, async () => ({ revision, areas }), "unused", async (_, base, options = {}) => {
  const messages = [3, 2, 1].filter(n => options.message ? n === options.message : !options.before || n < options.before)
    .slice(0, options.limit ?? 2).map(number => ({ number, author: "Demo operator", recipient: "All",
      subject: `${base === "welcome" ? "Welcome to MysticWeb" : "Workshop notes"} ${number}`,
      dates: { written: 1793145600, received: 0, processed: 0, timezone: null }, attributes: 0, messageId: "synthetic", replyTo: 0, firstReply: 0, nextReply: 0, replyId: "", encoding: "utf-8",
      ...(options.message ? { body: "This is a synthetic message. No live BBS data is connected.\n\nTry both accounts: Bob cannot see Alice's workshop." } : {}) }));
  return { messages, nextBefore: !options.message && messages.at(-1)?.number !== 1 ? messages.at(-1)?.number ?? null : null, scanned: messages.length, skipped: 0 };
});

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" } });
}
function token(request: Request) {
  const matches = (request.headers.get("cookie") ?? "").split(";").map(s => s.trim()).filter(s => s.startsWith(COOKIE + "="));
  return matches.length === 1 ? matches[0].slice(COOKIE.length + 1) : "";
}
function withCookie(res: Response, value: string, maxAge: number) {
  res.headers.set("Set-Cookie", `${COOKIE}=${value}; Path=/api/development; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`);
  return res;
}

export async function developmentRequest(request: Request): Promise<Response> {
  if (!developmentEnabled()) return response({ error: "Unavailable" }, 404);
  const url = new URL(request.url);
  if (url.origin !== ORIGIN || request.headers.get("host") !== "127.0.0.1:3000") return response({ error: "Loopback only" }, 403);
  if (request.method !== "GET" && (request.headers.get("origin") !== ORIGIN ||
    (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin"))) return response({ error: "Origin rejected" }, 403);
  for (const [key, session] of sessions) if (session.expires <= Date.now()) sessions.delete(key);
  if (request.method === "POST") {
    // No credential collection: select an explicit disposable identity by ID.
    if (url.searchParams.size !== 1 || !["42", "73"].includes(url.searchParams.get("account") ?? "")) return response({ error: "Unknown demo account" }, 400);
    sessions.delete(token(request));
    if (sessions.size >= 100) return response({ error: "Demo session limit reached; restart development server" }, 429);
    const value = randomBytes(32).toString("base64url");
    sessions.set(value, { userId: Number(url.searchParams.get("account")), expires: Date.now() + 3600000 });
    return withCookie(response({ ok: true }), value, 3600);
  }
  if (request.method === "DELETE") {
    sessions.delete(token(request));
    return withCookie(response({ ok: true }), "", 0);
  }
  if (request.method !== "GET") return response({ error: "Method unavailable" }, 405);
  const session = sessions.get(token(request));
  if (!session) return response({ error: "Choose a demo account" }, 401);
  try {
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length || keys.some(k => !["area", "message", "before"].includes(k))) throw new Error();
    const identity = { instance: "demo", userId: session.userId };
    if (!keys.length) return response({ account: accounts.find(a => a.userId === session.userId), areas: await reader.areas(identity) });
    return response(await reader.read(identity, numericId(url.searchParams.get("area")), {
      ...(url.searchParams.has("message") ? { message: numericId(url.searchParams.get("message")) } : {}),
      ...(url.searchParams.has("before") ? { before: numericId(url.searchParams.get("before")) } : {}) }));
  } catch { return response({ error: "Message access unavailable" }, 404); }
}
