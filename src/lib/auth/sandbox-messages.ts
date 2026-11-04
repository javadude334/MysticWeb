import "server-only";
import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { AuthStore } from "./store";
import { sandboxOriginAllowed } from "./sandbox-origin";
import { readNativeAccountSnapshot } from "../mystic/native-account-status";
import { readMysticConfiguration } from "../mystic/config";
import { isJamBaseName, readJam } from "../mystic/jam";
import { MessageAccess } from "../mystic/message-access";
import { searchMessages } from "../mystic/search-messages";

const COOKIE = "__Host-mysticweb_session";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

export async function sandboxMessages(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development" || !sandboxOriginAllowed(request, false))
    return json({ error: "Unavailable" }, 404);
  if (request.method !== "GET") return json({ error: "Method unavailable" }, 405);
  const root = process.env.MYSTIC_DATA_ROOT;
  const db = process.env.MYSTICWEB_SESSION_DB;
  if (!root || !path.isAbsolute(root) || !db || !path.isAbsolute(db))
    return json({ error: "Sandbox reader is not configured" }, 503);
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
    const access = new MessageAccess(groups, areas, account.securityLevel);
    const eligibleGroups = access.getGroups();
    const visible = eligibleGroups.flatMap(group => access.getMessageAreas(group.id));
    const catalogAreas = visible.map(area => ({
      id: area.id, name: area.name, groupIds: [area.inferredGroupId as number],
      readable: access.canRead(area.id),
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
      const authorizedAreas = access.getSearchAreas(groupName, allGroups);
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
      return json({ groupId, areas: access.getMessageAreas(groupId).map(area => ({ id: area.id, name: area.name, groupIds: [groupId], readable: access.canRead(area.id) })) });
    }
    if (!params.has("area")) {
      if (keys.length) return json({ error: "Invalid request" }, 400);
      // Only areas passing the current-account eligibility filter are listed.
      return json({ groups: eligibleGroups,
        areas: catalogAreas });
    }
    const id = Number(params.get("area"));
    const area = access.getArea(id);
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
