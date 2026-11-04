import "server-only";
import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { AuthStore } from "./store";
import { sandboxOriginAllowed } from "./sandbox-origin";
import { readNativeAccountSnapshot } from "../mystic/native-account-status";
import { readMysticConfiguration } from "../mystic/config";
import { isJamBaseName, readJam } from "../mystic/jam";
import { candidateMeetsSecurityLevel } from "../mystic/acs-candidate";
import { searchMessages } from "../mystic/search-messages";

const COOKIE = "__Host-mysticweb_session";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

/** Conservative sandbox catalog filter. Netmail is not public EchoMail.
 * This is not a substitute for decoding native area kind and group ACS.
 */
function isNetmailNamedGroup(name: string): boolean {
  return /(?:^|[\\s_\\-])netmail(?:$|[\\s_\\-])/i.test(name);
}


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
        keys.some(k => !["area", "group", "message", "before", "limit", "search", "groupName", "allGroups"].includes(k)) ||
        (params.has("message") && params.has("before")))
      return json({ error: "Invalid request" }, 400);
    const { groups, areas } = await readMysticConfiguration();
    // Do not reveal high-security or known Netmail groups/areas to this user.
    // Native group ACS and area-kind certification are still outstanding.
    const eligibleGroups = groups.filter(g => !isNetmailNamedGroup(g.name));
    const eligibleIds = new Set(eligibleGroups.map(g => g.id));
    const eligibleAreas = areas.filter(a => a.inferredGroupId !== null &&
      eligibleIds.has(a.inferredGroupId) && isJamBaseName(a.jamBase) &&
      candidateMeetsSecurityLevel(a.security[0], a.security[1], account.securityLevel).candidate &&
      !isNetmailNamedGroup(a.name));
    // JAM access remains independently limited by the operator allowlist.
    const visible = eligibleAreas.filter(a => approved.has(a.id));
    // Sandbox catalog is informational only. Exposing an area in the
    // navigation does not authorize reading its JAM messages.
    const catalogAreas = eligibleAreas
      .map(a => ({
        id: a.id, name: a.name, groupIds: [a.inferredGroupId as number],
        readable: visible.some(v => v.id === a.id),
      }));
    if (params.has("search")) {
      if (keys.some(key => !["search", "groupName", "allGroups"].includes(key)))
        return json({ error: "Invalid search request" }, 400);
      const query = params.get("search") ?? "";
      const groupName = params.get("groupName") ?? "";
      const allGroupsValue = params.get("allGroups");
      if (query.trim().length < 2 || query.length > 120 ||
          (allGroupsValue !== "true" && allGroupsValue !== "false"))
        return json({ error: "Invalid search request" }, 400);
      const allGroups = allGroupsValue === "true";
      if (!allGroups && !eligibleGroups.some(group => group.name === groupName))
        return json({ error: "Group unavailable" }, 404);
      const jamRoot = process.env.MYSTICWEB_SANDBOX_JAM_ROOT;
      if (!jamRoot || !path.isAbsolute(jamRoot))
        return json({ error: "Sandbox JAM root not configured" }, 503);
      const sandboxStat = await lstat(root);
      const jamStat = await lstat(jamRoot);
      if (!sandboxStat.isDirectory() || sandboxStat.isSymbolicLink() ||
          !jamStat.isDirectory() || jamStat.isSymbolicLink())
        return json({ error: "Unsafe sandbox directory" }, 503);
      const sandboxReal = await realpath(root);
      const jamReal = await realpath(jamRoot);
      const relative = path.relative(sandboxReal, jamReal);
      if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
          path.isAbsolute(relative))
        return json({ error: "Sandbox JAM directory must be inside the sandbox" }, 503);
      const authorizedAreas = visible.flatMap(area => {
        const group = groups.find(group => group.id === area.inferredGroupId);
        return group ? [{
          id: area.id, name: area.name, groupId: group.id,
          groupName: group.name, jamBase: area.jamBase,
        }] : [];
      });
      return json(await searchMessages(query, groupName, allGroups, authorizedAreas, jamReal));
    }
    if (params.has("group")) {
      // Match the production reader's group-selection API. The operator
      // allowlist and conservative ACS threshold remain mandatory.
      if (params.has("area") || params.has("message") ||
          params.has("before") || params.has("limit"))
        return json({ error: "Invalid request" }, 400);
      const groupValue = params.get("group");
      if (!groupValue || !/^[1-9][0-9]*$/.test(groupValue) ||
          !Number.isSafeInteger(Number(groupValue)) || Number(groupValue) > 65535)
        return json({ error: "Invalid request" }, 400);
      const groupId = Number(groupValue);
      if (!eligibleGroups.some(group => group.id === groupId))
        return json({ error: "Group unavailable" }, 404);
      return json({ groupId, areas: catalogAreas.filter(area => area.groupIds.includes(groupId)) });
    }
    if (!params.has("area")) {
      if (keys.length) return json({ error: "Invalid request" }, 400);
      // The development catalog may show all configured group names, but
      // individual area listings and JAM reads remain operator-allowlisted.
      return json({ groups: eligibleGroups,
        areas: catalogAreas });
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
    // The operator-selected JAM directory must be physically contained within
    // the configured sandbox. A second environment variable is not permission
    // to read from another Mystic installation.
    const sandboxStat = await lstat(root);
    const jamStat = await lstat(jamRoot);
    if (!sandboxStat.isDirectory() || sandboxStat.isSymbolicLink() ||
        !jamStat.isDirectory() || jamStat.isSymbolicLink())
      return json({ error: "Unsafe sandbox directory" }, 503);
    const sandboxReal = await realpath(root);
    const jamReal = await realpath(jamRoot);
    const relative = path.relative(sandboxReal, jamReal);
    if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
        path.isAbsolute(relative))
      return json({ error: "Sandbox JAM directory must be inside the sandbox" }, 503);
    const page = await readJam(jamReal, area.jamBase, { limit, ...(message ? { message } : {}),
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
