import "server-only";
import path from "node:path";
import { AuthStore } from "./store";
import { sandboxOriginAllowed } from "./sandbox-origin";
import { readNativeAccountSnapshot } from "../mystic/native-account-status";
import { readMysticConfiguration } from "../mystic/config";
import { isJamBaseName, readJam } from "../mystic/jam";
import { candidateMeetsSecurityLevel } from "../mystic/acs-candidate";

const COOKIE = "__Host-mysticweb_session";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

/** Explicit operator-approved, read-only preview. NOT a Mystic ACS implementation.
 * The allowlist is required so an authenticated user never gains access merely
 * because an area happens to have a readable JAM file.
 */
export async function sandboxMessages(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development" || !sandboxOriginAllowed(request, false))
    return json({ error: "Unavailable" }, 404);
  if (request.method !== "GET") return json({ error: "Method unavailable" }, 405);
  const root = process.env.MYSTIC_DATA_ROOT;
  const db = process.env.MYSTICWEB_SESSION_DB;
  const allow = process.env.MYSTICWEB_SANDBOX_READ_AREAS;
  if (!root || !path.isAbsolute(root) || !db || !path.isAbsolute(db) || !allow ||
      !/^[1-9][0-9]*(?:\s*,\s*[1-9][0-9]*)*$/.test(allow))
    return json({ error: "Sandbox reader requires an explicit area allowlist" }, 503);
  const approved = new Set(allow.split(",").map(value => Number(value.trim())));
  if ([...approved].some(id => !Number.isSafeInteger(id) || id > 65535))
    return json({ error: "Invalid sandbox allowlist" }, 503);
  const cookies = (request.headers.get("cookie") ?? "").split(";").map(x => x.trim())
    .filter(x => x.startsWith(COOKIE + "="));
  if (cookies.length !== 1) return json({ error: "Sign in required" }, 401);
  try {
    const store = new AuthStore(db);
    let identity;
    try { identity = store.read(cookies[0].slice(COOKIE.length + 1)); }
    finally { store.close(); }
    if (!identity || identity.instance !== "mystic_sandbox")
      return json({ error: "Sign in required" }, 401);
    const account = await readNativeAccountSnapshot(path.join(root, "data", "users.dat"), identity.userId);
    if (!account || account.locked || account.deletedCandidate || account.passwordChangeRequired)
      return json({ error: "Account unavailable" }, 401);
    const params = new URL(request.url).searchParams;
    const keys = [...params.keys()];
    if (new Set(keys).size !== keys.length ||
        keys.some(k => !["area", "message", "before", "limit"].includes(k)) ||
        (params.has("message") && params.has("before")))
      return json({ error: "Invalid request" }, 400);
    const { groups, areas } = await readMysticConfiguration();
    // Require unambiguous group mapping and the exact operator-approved ID.
    const visible = areas.filter(a => approved.has(a.id) && candidateMeetsSecurityLevel(a.security[0], a.security[1], account.securityLevel).candidate && a.inferredGroupId !== null &&
      groups.some(g => g.id === a.inferredGroupId) && isJamBaseName(a.jamBase));
    if (!params.has("area")) {
      if (keys.length) return json({ error: "Invalid request" }, 400);
      const ids = new Set(visible.map(a => a.inferredGroupId));
      return json({ groups: groups.filter(g => ids.has(g.id)),
        areas: visible.map(a => ({ id: a.id, name: a.name, groupIds: [a.inferredGroupId] })) });
    }
    const id = Number(params.get("area"));
    const area = visible.find(a => a.id === id);
    if (!area || !Number.isSafeInteger(id)) return json({ error: "Area unavailable" }, 404);
    const integer = (key: string, max: number) => {
      const value = params.get(key);
      if (value === null) return undefined;
      if (!/^[1-9][0-9]*$/.test(value)) throw new Error("Invalid number");
      const n = Number(value);
      if (!Number.isSafeInteger(n) || n > max) throw new Error("Invalid number");
      return n;
    };
    const message = integer("message", 0xffffffff);
    const before = integer("before", 0xffffffff);
    const limit = integer("limit", 50) ?? 25;
    // This preview supports only the operator-selected sandbox JAM directory.
    // Production must use verified per-area paths and native ACS authorization.
    const jamRoot = process.env.MYSTICWEB_SANDBOX_JAM_ROOT;
    if (!jamRoot || !path.isAbsolute(jamRoot))
      return json({ error: "Sandbox JAM root not configured" }, 503);
    const page = await readJam(jamRoot, area.jamBase, { limit, ...(message ? { message } : {}),
      ...(before ? { before } : {}) });
    return json({ area: { id: area.id, name: area.name },
      messages: page.messages.map(m => ({ number: m.number, author: m.author,
        recipient: m.recipient, subject: m.subject, dates: m.dates, replyTo: m.replyTo,
        firstReply: m.firstReply, nextReply: m.nextReply, ...(m.body === undefined ? {} : { body: m.body }) })),
      nextBefore: page.nextBefore });
  } catch {
    return json({ error: "Sandbox messages unavailable" }, 404);
  }
}
