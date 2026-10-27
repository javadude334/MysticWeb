import "server-only";
import { allowAuthMutation, authCookie } from "./http";
import { AuthStore, rateBucket, type Identity } from "./store";
import { NativeAccess } from "./native";
import { MessageReader, numericId } from "../mystic/reader";

const COOKIE = "__Host-mysticweb_session";
const HEADERS = { "Cache-Control": "private, no-store", "Pragma": "no-cache", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
function response(data: unknown, status = 200) { return Response.json(data, { status, headers: HEADERS }); }
function cookie(request: Request): string | undefined {
  const values = (request.headers.get("cookie") ?? "").split(";").map(s => s.trim()).filter(s => s.startsWith(COOKIE + "="));
  return values.length === 1 ? values[0].slice(COOKIE.length + 1) : undefined;
}
function setCookie(res: Response, token: string | null) {
  const value = authCookie(token);
  res.headers.set("Set-Cookie", `${value.name}=${value.value}; Path=/; Max-Age=${value.maxAge}; Secure; HttpOnly; SameSite=Strict`);
  return res;
}
async function credentials(request: Request): Promise<{ username: string; password: string }> {
  if (request.headers.get("content-type") !== "application/json" || request.headers.has("content-encoding")) throw new Error();
  const reader = request.body?.getReader();
  if (!reader) throw new Error();
  const chunks: Uint8Array[] = []; let size = 0;
  // Total deadline, including stalled chunked bodies. Cancel without awaiting
  // an uncooperative peer and never log input/parser exceptions.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new Error()); }, 1500); });
  try {
    return await Promise.race([deadline, (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2048) throw new Error();
        chunks.push(value);
      }
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
      if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "password,username" ||
        typeof value.username !== "string" || typeof value.password !== "string") throw new Error();
      return value;
    })()]);
  } finally {
    if (timer) clearTimeout(timer);
    void reader.cancel().catch(() => {});
    for (const chunk of chunks) chunk.fill(0);
  }
}

/** Explicit dependency injection only. Production remains unconfigured until
 * native runtime and transport evidence is reviewed. Never derive trust from Host.
 */
export class WebAccess {
  constructor(private readonly store: AuthStore, private readonly native: NativeAccess,
    private readonly messages: MessageReader, private readonly origin: string, private readonly rateKey: Buffer,
    private readonly clientIdentity: (request: Request) => string | null) {
    if (rateKey.length < 32 || !allowAuthMutation("POST", new Headers({ origin }), origin)) throw new Error("Access unavailable");
  }

  async login(request: Request): Promise<Response> {
    if (!allowAuthMutation(request.method, request.headers, this.origin)) return response({ error: "Sign-in unavailable" }, 403);
    try {
      const client = this.clientIdentity(request);
      if (!client) return response({ error: "Sign-in unavailable" }, 503);
      // Bound global/client work before even parsing credentials.
      const limits = [this.store.consume(rateBucket(this.rateKey, "global", "login"), 100, 60000),
        this.store.consume(rateBucket(this.rateKey, "client", client), 10, 60000)];
      if (limits.some(x => !x.allowed)) return response({ error: "Sign-in unavailable" }, 429);
      const input = await credentials(request);
      // Conservative account aliases still share a client/global cap. The native
      // provider owns name semantics; this normalization is for throttling only.
      const account = input.username.normalize("NFKC").trim().toLowerCase();
      if (!account || Buffer.byteLength(account) > 120 || !this.store.consume(rateBucket(this.rateKey, "account", account), 5, 60000).allowed)
        return response({ error: "Sign-in unavailable" }, 429);
      const identity = await this.native.authenticate(input.username, input.password);
      input.password = "";
      if (!identity) return response({ error: "Sign-in unavailable" }, 401);
      const token = this.store.create(identity, cookie(request));
      return setCookie(response({ ok: true }), token);
    } catch { return response({ error: "Sign-in unavailable" }, 503); }
  }

  async logout(request: Request): Promise<Response> {
    if (!allowAuthMutation(request.method, request.headers, this.origin)) return response({ error: "Access unavailable" }, 403);
    try { this.store.revoke(cookie(request)); return setCookie(response({ ok: true }), null); }
    catch { return response({ error: "Access unavailable" }, 503); }
  }

  private async identity(request: Request): Promise<Identity | null> {
    const identity = this.store.read(cookie(request));
    if (!identity) return null;
    if (!await this.native.accountValid(identity)) { this.store.revokeIdentity(identity); return null; }
    return identity;
  }

  async read(request: Request): Promise<Response> {
    if (request.method !== "GET") return response({ error: "Access unavailable" }, 405);
    try {
      const identity = await this.identity(request);
      if (!identity) return response({ error: "Access unavailable" }, 401);
      const query = new URL(request.url).searchParams;
      const names = [...query.keys()];
      if (new Set(names).size !== names.length || names.some(k => !["area", "before", "limit", "message"].includes(k))) throw new Error();
      if (!query.has("area")) {
        if (names.length) throw new Error();
        return response({ areas: await this.messages.areas(identity) });
      }
      const options = {
        ...(query.has("before") ? { before: numericId(query.get("before")) } : {}),
        ...(query.has("message") ? { message: numericId(query.get("message")) } : {}),
        ...(query.has("limit") ? { limit: numericId(query.get("limit"), 50) } : {}),
      };
      return response(await this.messages.read(identity, numericId(query.get("area"), 65535), options));
    } catch { return response({ error: "Access unavailable" }, 404); }
  }
}

// No setter or environment activation flag: deployment needs a reviewed native
// driver and explicit composition after the documented end-to-end proof.
export function productionAccess(): WebAccess | null { return null; }
export function unavailable(): Response { return response({ error: "Access unavailable" }, 503); }
