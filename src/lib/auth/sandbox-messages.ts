import "server-only";
import path from "node:path";
import { lstat, realpath, readFile } from "node:fs/promises";
import { classifyJamMessage, getJamMessageReadState } from "../mystic/jam-message-read-state";
import { AuthStore } from "./store";
import { initializeMysticWebRuntime } from "../storage/runtime";
import { sandboxOriginAllowed } from "./sandbox-origin";
import { readNativeAccountSnapshot } from "../mystic/native-account-status";
import { readMysticConfiguration } from "../mystic/config";
import { isJamBaseName, readJam } from "../mystic/jam";
import { MessageAccess } from "../mystic/message-access";
import { searchMessages } from "../mystic/search-messages";
import { stableJamReceiptId, readUserMessageReceipt } from "../mystic/message-sidecar";
import { recordUserMessageRead } from "../mystic/message-receipt-writer";
import { appendOfflineJam } from "../mystic/jam-offline-writer";

const COOKIE = "__Host-mysticweb_session";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

export async function sandboxMessages(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development" || !sandboxOriginAllowed(request, request.method === "POST"))
    return json({ error: "Unavailable" }, 404);
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method unavailable" }, 405);
  const runtime = initializeMysticWebRuntime();
  const root = runtime.directories.rootDir;
  const db = runtime.databasePath;
  const jamRoot = runtime.directories.messageDir;
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
    const account = await readNativeAccountSnapshot(runtime.usersPath, identity.userId);
    if (!account || account.locked || account.deletedCandidate || account.passwordChangeRequired)
      return json({ error: "Account unavailable" }, 401);
    // Sandbox-only native posting. A separate operation prevents read-receipt
    // clients from accidentally triggering a message write.
    if (request.method === "POST" && new URL(request.url).pathname.endsWith("/api/messages") &&
        new URL(request.url).search === "?action=post") {
      if (request.headers.get("content-type") !== "application/json" ||
          request.headers.has("content-encoding")) return json({ error: "Invalid request" }, 400);
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (!Number.isSafeInteger(declared) || declared < 1 || declared > 70000)
        return json({ error: "Invalid request" }, 400);
      const raw = await request.text();
      if (Buffer.byteLength(raw, "utf8") > 70000) return json({ error: "Invalid request" }, 400);
      const input: unknown = JSON.parse(raw);
      if (!input || typeof input !== "object" || Array.isArray(input))
        return json({ error: "Invalid draft" }, 400);
      const post = input as Record<string, unknown>;
      const keys = Object.keys(post).sort().join(",");
      if (keys !== "area,body,recipient,subject" &&
          keys !== "area,body,recipient,replyTo,subject")
        return json({ error: "Invalid draft" }, 400);
      if (!Number.isSafeInteger(post.area) || (post.area as number) < 1 ||
          typeof post.recipient !== "string" || !post.recipient.trim() ||
          typeof post.subject !== "string" || !post.subject.trim() ||
          typeof post.body !== "string" || !post.body.trim() ||
          (post.replyTo !== undefined && (!Number.isSafeInteger(post.replyTo) ||
            (post.replyTo as number) < 1 || (post.replyTo as number) > 0xffffffff)) ||
          [post.recipient, post.subject].some(v => /[\x00-\x1f\x7f]/.test(v as string) || Buffer.byteLength(v as string) > 255) ||
          (post.body as string).length > 60000 || /[\x00\x1b\x7f]/.test(post.body as string))
        return json({ error: "Invalid draft" }, 400);
      const { groups, areas } = await readMysticConfiguration();
      const access = new MessageAccess(groups, areas, account.securityLevel);
      const area = access.getArea(post.area as number);
      if (!area || !access.canPost(area.id) || !isJamBaseName(area.jamBase))
        return json({ error: "Posting unavailable" }, 403);
      if (!jamRoot || !path.isAbsolute(jamRoot)) return json({ error: "Unavailable" }, 503);
      const [sandboxStat, jamStat] = await Promise.all([lstat(root), lstat(jamRoot)]);
      if (!sandboxStat.isDirectory() || sandboxStat.isSymbolicLink() ||
          !jamStat.isDirectory() || jamStat.isSymbolicLink())
        return json({ error: "Unavailable" }, 503);
      const [sandboxReal, jamReal] = await Promise.all([realpath(root), realpath(jamRoot)]);
      const relative = path.relative(sandboxReal, jamReal);
      if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
          path.isAbsolute(relative)) return json({ error: "Unavailable" }, 503);
      if (post.replyTo !== undefined) {
        const parent = await readJam(jamReal, area.jamBase, { message: post.replyTo as number });
        if (parent.messages.length !== 1 || parent.messages[0].number !== post.replyTo)
          return json({ error: "Reply parent unavailable" }, 404);
      }
      // Native account identity is server-owned. A native handle lookup must
      // replace this stable fallback before enabling production posting.
      const result = await appendOfflineJam(jamReal, area.jamBase, {
        author: `User #${identity.userId}`,
        recipient: (post.recipient as string).trim(),
        subject: (post.subject as string).trim(),
        body: post.body as string,
        timestamp: Math.floor(Date.now() / 1000),
        ...(post.replyTo === undefined ? {} : { replyTo: post.replyTo as number }),
      }, { offlineConfirmed: process.env.MYSTICWEB_OFFLINE_JAM_WRITE === "I_UNDERSTAND_OFFLINE_ONLY" });
      return json({ posted: true, area: area.id, number: result.number, messageId: result.messageId }, 201);
    }
    // A message-open mutation must use the same current account, area ACS and
    // verified sandbox JAM path as the read endpoint. Never accept user/base/ID.
    if (request.method === "POST") {
      if (new URL(request.url).search || request.headers.get("content-type") !== "application/json" ||
          request.headers.has("content-encoding")) return json({ error: "Invalid request" }, 400);
      const length = Number(request.headers.get("content-length") ?? "0");
      if (!Number.isSafeInteger(length) || length < 1 || length > 256)
        return json({ error: "Invalid request" }, 400);
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 256) return json({ error: "Invalid request" }, 400);
      const input = JSON.parse(raw) as { area?: unknown; message?: unknown };
      if (!input || Array.isArray(input) || Object.keys(input).sort().join(",") !== "area,message" ||
          !Number.isSafeInteger(input.area) || !Number.isSafeInteger(input.message) ||
          (input.area as number) < 1 || (input.message as number) < 1 ||
          (input.message as number) > 0xffffffff) return json({ error: "Invalid request" }, 400);
      const { groups, areas } = await readMysticConfiguration();
      const access = new MessageAccess(groups, areas, account.securityLevel);
      const area = access.getArea(input.area as number);
      if (!area || !access.canRead(area.id) || !isJamBaseName(area.jamBase))
        return json({ error: "Area unavailable" }, 403);
      if (!jamRoot || !path.isAbsolute(jamRoot)) return json({ error: "Unavailable" }, 503);
      const [sandboxStat, jamStat] = await Promise.all([lstat(root), lstat(jamRoot)]);
      if (!sandboxStat.isDirectory() || sandboxStat.isSymbolicLink() ||
          !jamStat.isDirectory() || jamStat.isSymbolicLink()) return json({ error: "Unavailable" }, 503);
      const [sandboxReal, jamReal] = await Promise.all([realpath(root), realpath(jamRoot)]);
      const relative = path.relative(sandboxReal, jamReal);
      if (!relative || relative === ".." || relative.startsWith(".." + path.sep) ||
          path.isAbsolute(relative)) return json({ error: "Unavailable" }, 503);
      const result = await readJam(jamReal, area.jamBase, { message: input.message as number });
      if (result.messages.length !== 1 || result.messages[0].number !== input.message)
        return json({ error: "Message unavailable" }, 404);
      const id = stableJamReceiptId(identity.instance, area.id, area.jamBase, result.messages[0]);
      // Separate from the native JAM directory; no JLR write is performed.
      const metadataRoot = path.join(path.dirname(db), "mysticweb-message-metadata");
      await recordUserMessageRead(metadataRoot, identity.instance, area.id, identity.userId, id);
      return json({ read: true, message: input.message });
    }
    const params = new URL(request.url).searchParams;
    const keys = [...params.keys()];
    if (new Set(keys).size !== keys.length ||
        keys.some(k => !["area", "group", "message", "before", "limit", "search", "groupName", "allGroups", "unreadGroup"].includes(k)) ||
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
    if (params.has("unreadGroup")) {
      if (keys.length !== 1 || !/^[1-9][0-9]*$/.test(params.get("unreadGroup") ?? ""))
        return json({ error: "Invalid request" }, 400);
      const groupId = Number(params.get("unreadGroup"));
      if (!Number.isSafeInteger(groupId) || groupId > 65535 ||
          !eligibleGroups.some(group => group.id === groupId))
        return json({ error: "Group unavailable" }, 404);
      if (!jamRoot || !path.isAbsolute(jamRoot)) return json({ error: "Sandbox JAM root not configured" }, 503);
      const [sandboxStat, jamStat] = await Promise.all([lstat(root), lstat(jamRoot)]);
      if (!sandboxStat.isDirectory() || sandboxStat.isSymbolicLink() ||
          !jamStat.isDirectory() || jamStat.isSymbolicLink())
        return json({ error: "Unsafe sandbox directory" }, 503);
      const [sandboxReal, jamReal] = await Promise.all([realpath(root), realpath(jamRoot)]);
      const relative = path.relative(sandboxReal, jamReal);
      if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative))
        return json({ error: "Unsafe sandbox JAM directory" }, 503);
      const eligible = access.getMessageAreas(groupId).filter(a => access.canRead(a.id) && isJamBaseName(a.jamBase));
      const unreadAreaIds: number[] = [];
      // Bound concurrency and report only positive evidence, never guess that
      // a missing/ambiguous pointer means all messages are unread.
      for (let start = 0; start < eligible.length; start += 8) {
        const matches = await Promise.all(eligible.slice(start, start + 8).map(async area => {
          try {
            // Match the message list's MysticWeb receipt semantics. The native
            // JLR pointer is independent and must not suppress unread web mail.
            const latest = await readJam(jamReal, area.jamBase, { limit: 50 });
            const metadataRoot = path.join(path.dirname(db), "mysticweb-message-metadata");
            const receipt = await readUserMessageReceipt(metadataRoot, identity.instance, area.id, identity.userId);
            return latest.messages.some(m =>
              !receipt?.messages[stableJamReceiptId(identity.instance, area.id, area.jamBase, m)]
            ) ? area.id : null;
          } catch { return null; }
        }));
        for (const id of matches) if (id !== null) unreadAreaIds.push(id);
      }
      return json({ groupId, unreadAreaIds });
    }
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
    // Read only the .jlr belonging to this already-authorized JAM base.
    // Never trust a URL-supplied user ID or base path. Missing/unsafe state is unknown.
    let pointerState = null;
    try {
      if (!isJamBaseName(area.jamBase)) throw new Error("Invalid base");
      const filename = await realpath(path.join(jamReal, `${area.jamBase}.jlr`));
      if (path.dirname(filename) !== jamReal) throw new Error("Unsafe pointer path");
      const info = await lstat(filename);
      if (!info.isFile() || info.size > 1048576) throw new Error("Unsafe pointer file");
      pointerState = getJamMessageReadState(await readFile(filename), identity.userId);
    } catch { /* Read-state is optional; never downgrade message authorization. */ }
    const metadataRoot = path.join(path.dirname(db), "mysticweb-message-metadata");
    const receipt = await readUserMessageReceipt(metadataRoot, identity.instance, area.id, identity.userId);
    return json({ area: { id: area.id, name: area.name },
      messages: page.messages.map(m => ({ number: m.number, author: m.author,
        readPosition: classifyJamMessage(pointerState, m.number),
        webRead: !!receipt?.messages[stableJamReceiptId(identity.instance, area.id, area.jamBase, m)],
        recipient: m.recipient, subject: m.subject, dates: m.dates, replyTo: m.replyTo,
        firstReply: m.firstReply, nextReply: m.nextReply, ...(m.body === undefined ? {} : { body: m.body }) })),
      nextBefore: page.nextBefore });
  } catch {
    return json({ error: "Sandbox messages unavailable" }, 404);
  }
}
