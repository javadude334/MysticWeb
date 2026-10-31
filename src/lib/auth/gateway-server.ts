import "server-only";
import https from "node:https";
import { isIP } from "node:net";
import { TLSSocket } from "node:tls";
import { validatedNativeReply, type NativeProvider, type NativeRequest } from "./native";

const DENIED = { error: "Access unavailable" };
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const number = (value: unknown, max: number) => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;

export function parseGatewayRequest(raw: string, instance: string): NativeRequest | null {
  try {
    if (Buffer.byteLength(raw) > 4096) return null;
    const value: unknown = JSON.parse(raw);
    if (!object(value)) return null;
    // Requests are flat JSON. Detect repeated decoded property names, including
    // escaped spellings, before normal schema validation; JSON.parse alone loses them.
    const names = new Set<string>();
    for (const match of raw.matchAll(/"(?:\\.|[^"\\])*"/g)) {
      if (!raw.slice(match.index! + match[0].length).trimStart().startsWith(":")) continue;
      const name = JSON.parse(match[0]) as string;
      if (names.has(name)) return null;
      names.add(name);
    }
    const extras = value.operation === "authenticate" ? ["username", "password"] :
      value.operation === "account" ? ["userId"] :
      value.operation === "authorize" ? ["userId", "areaId", "catalogRevision"] : null;
    if (!extras || Object.keys(value).sort().join(",") !== ["version", "instance", "nonce", "operation", ...extras].sort().join(",") ||
      value.version !== 1 || value.instance !== instance || typeof value.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.nonce)) return null;
    if (value.operation === "authenticate") {
      if (typeof value.username !== "string" || typeof value.password !== "string" || !value.username || !value.password ||
        Buffer.byteLength(value.username) > 120 || Buffer.byteLength(value.password) > 256 || /[\x00-\x1f\x7f]/.test(value.username + value.password)) return null;
    } else if (!number(value.userId, 0x7fffffff)) return null;
    if (value.operation === "authorize" && (!number(value.areaId, 65535) ||
      typeof value.catalogRevision !== "string" || !/^[a-f0-9]{64}$/.test(value.catalogRevision))) return null;
    return value as NativeRequest;
  } catch { return null; }
}

/** Private mTLS boundary. Null provider deliberately serves health only and
 * denies authentication; network reachability is not native certification. */
export function createGatewayServer(options: {
  instance: string;
  allowedClient: string;
  tls: { ca: Buffer; cert: Buffer; key: Buffer };
  provider: NativeProvider | null;
}) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(options.instance) || !isIP(options.allowedClient)) throw new Error("Gateway unavailable");
  let active = 0;
  const nonces = new Map<string, number>();
  const server = https.createServer({ ...options.tls, requestCert: true, rejectUnauthorized: true, minVersion: "TLSv1.2",
    maxHeaderSize: 4096, handshakeTimeout: 3000,
  }, async (request, response) => {
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "Connection": "close" });
      response.end(JSON.stringify(body));
    };
    const peer = request.socket.remoteAddress?.replace(/^::ffff:/, "");
    if (!(request.socket instanceof TLSSocket) || !request.socket.authorized || peer !== options.allowedClient) { request.resume(); send(403, DENIED); return; }
    if (request.method === "GET" && request.url === "/health") {
      request.resume(); send(200, { status: "ok", nativeAccess: "unverified" }); return;
    }
    if (request.method !== "POST" || request.url !== "/v1/native" || active >= 8 ||
      request.headers["content-type"] !== "application/json" || request.headers["transfer-encoding"] || request.headers["content-encoding"] ||
      !/^[1-9][0-9]{0,3}$/.test(request.headers["content-length"] ?? "") || Number(request.headers["content-length"]) > 4096) {
      request.resume(); send(400, DENIED); return;
    }
    active++;
    const chunks: Buffer[] = [];
    const controller = new AbortController();
    let expire: (() => void) | undefined;
    const timer = setTimeout(() => { controller.abort(); expire?.(); request.destroy(); response.destroy(); }, 1500);
    let parsed: NativeRequest | null = null;
    let body: Buffer | undefined;
    try {
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 4096) throw new Error();
        chunks.push(chunk);
      }
      if (size !== Number(request.headers["content-length"])) throw new Error();
      body = Buffer.concat(chunks);
      parsed = parseGatewayRequest(new TextDecoder("utf8", { fatal: true }).decode(body), options.instance);
      const now = performance.now();
      for (const [nonce, expires] of nonces) if (expires <= now) nonces.delete(nonce);
      if (!parsed || nonces.has(parsed.nonce) || nonces.size >= 4096) { send(403, DENIED); return; }
      nonces.set(parsed.nonce, now + 60000);
      if (!options.provider) { send(503, DENIED); return; }
      const result = await Promise.race([
        options.provider.request(parsed, { signal: controller.signal }),
        new Promise<never>((_resolve, reject) => { expire = () => reject(new Error()); }),
      ]);
      const reply = validatedNativeReply(parsed, result);
      if (controller.signal.aborted || !reply) { send(403, DENIED); return; }
      send(200, reply);
    } catch { if (!response.destroyed && !response.headersSent) send(503, DENIED); }
    finally {
      clearTimeout(timer); controller.abort(); active--;
      if (parsed?.operation === "authenticate") parsed.password = "";
      body?.fill(0); for (const chunk of chunks) chunk.fill(0);
    }
  });
  server.maxConnections = 16;
  server.maxHeadersCount = 16;
  server.headersTimeout = 3000;
  server.requestTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.on("tlsClientError", () => {});
  server.on("clientError", (_error, socket) => socket.destroy());
  return server;
}
