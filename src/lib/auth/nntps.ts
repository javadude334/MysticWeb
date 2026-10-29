import "server-only";
import { connect, type TLSSocket } from "node:tls";

export class NntpsError extends Error {
  constructor(public readonly reason: "UNAVAILABLE" | "CREDENTIALS_REJECTED" = "UNAVAILABLE", public readonly stage?: string, public readonly statusCode?: number) { super("Secure Mystic connection unavailable"); }
}

export interface NntpsEndpoint {
  host: string;
  port: number;
  servername: string;
  ca: Buffer;
}

function groupName(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9+_.-]{0,59}$/.test(value) && !value.includes("..");
}
function articleNumber(value: number) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 0x7fffffff;
}

/** Candidate protocol adapter only. Not a NativeProvider: an NNTP success reply
 * does not establish a permanent BBS ID, full account policy, or ACS semantics.
 * Every instance owns exactly one native authenticated connection; never pool
 * connections across identities or silently reconnect using retained passwords.
 */
export class NntpsSession {
  private buffer = Buffer.alloc(0);
  private lines: string[] = [];
  private queuedBytes = 0;
  private waiting?: { resolve: (line: string) => void; reject: (error: Error) => void };
  private closed = false;
  private busy = false;
  private authenticated = false;
  private stage = "TLS";

  private constructor(private readonly socket: TLSSocket) {
    socket.on("error", () => this.close());
    socket.on("close", () => this.close());
    socket.setTimeout(30000, () => this.close());
    socket.on("data", (chunk: Buffer) => {
      if (this.closed) return;
      this.buffer = Buffer.concat([this.buffer, chunk]);
      if (this.buffer.length + this.queuedBytes > 1024 * 1024) { this.close(); return; }
      let end: number;
      while ((end = this.buffer.indexOf("\r\n")) !== -1) {
        if (end > 8192) { this.close(); return; }
        const line = this.buffer.subarray(0, end).toString("latin1");
        this.buffer = this.buffer.subarray(end + 2);
        if (/[\r\n\x00]/.test(line)) { this.close(); return; }
        if (this.waiting) {
          const pending = this.waiting; this.waiting = undefined; pending.resolve(line);
        } else { this.lines.push(line); this.queuedBytes += line.length + 2; }
      }
      if (this.buffer.length > 8192) this.close();
    });
  }

  static async login(endpoint: NntpsEndpoint, username: string, password: string): Promise<NntpsSession> {
    // Deliberately limited to known ASCII input until A48's wire encoding is proven.
    if (!/^[\x21-\x7e][\x20-\x7e]{0,29}$/.test(username) ||
      !/^[\x20-\x7e]{1,25}$/.test(password) || !endpoint.host || !endpoint.servername ||
      !Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535 || !endpoint.ca.length) throw new NntpsError();
    const socket = connect({ host: endpoint.host, port: endpoint.port, servername: endpoint.servername,
      ca: endpoint.ca, rejectUnauthorized: true, minVersion: "TLSv1.2" });
    const session = new NntpsSession(socket);
    try {
      await session.run(async () => {
        await new Promise<void>((resolve, reject) => {
          socket.once("secureConnect", () => socket.authorized ? resolve() : reject(new NntpsError()));
          socket.once("error", () => reject(new NntpsError()));
          socket.once("close", () => reject(new NntpsError()));
        });
        session.stage = "GREETING";
        await session.status([200, 201]);
        session.stage = "AUTH_USER";
        session.send(`AUTHINFO USER ${username}`);
        // Do not accept an already-authorized/anonymous connection as a password match.
        await session.status([381]);
        session.stage = "AUTH_PASS";
        session.send(`AUTHINFO PASS ${password}`);
        password = "";
        await session.status([281]);
        session.authenticated = true;
      }, false);
      return session;
    } catch (error) { session.close(); throw error instanceof NntpsError ? error : new NntpsError(); }
    finally { password = ""; }
  }

  close() {
    if (this.closed) return;
    this.closed = true; this.authenticated = false;
    this.buffer.fill(0); this.buffer = Buffer.alloc(0); this.lines = []; this.queuedBytes = 0;
    this.waiting?.reject(new NntpsError()); this.waiting = undefined;
    this.socket.destroy();
  }

  async quit(): Promise<void> {
    if (this.closed) return;
    try { await this.run(async () => { this.stage = "QUIT"; this.send("QUIT"); await this.status([205]); }); }
    finally { this.close(); }
  }

  private async run<T>(action: () => Promise<T>, requireAuth = true, preserveSelectionDenial = false): Promise<T> {
    if (this.busy || this.closed || (requireAuth && !this.authenticated)) throw new NntpsError();
    this.busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([action(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { this.close(); reject(new NntpsError()); }, 3000);
      })]);
    } catch (error) { const failure = error instanceof NntpsError ? error : new NntpsError(); if (!(preserveSelectionDenial && failure.stage === "GROUP_SELECT" && [411, 450].includes(failure.statusCode ?? 0))) this.close(); throw new NntpsError(failure.reason, failure.stage ?? this.stage, failure.statusCode); }
    finally { if (timer) clearTimeout(timer); this.busy = false; }
  }

  private send(command: string) {
    if (this.closed || /[\r\n\x00]/.test(command)) throw new NntpsError();
    this.socket.write(command + "\r\n", "ascii");
  }
  private line(): Promise<string> {
    if (this.closed || this.waiting) return Promise.reject(new NntpsError());
    const line = this.lines.shift();
    if (line !== undefined) { this.queuedBytes -= line.length + 2; return Promise.resolve(line); }
    return new Promise((resolve, reject) => { this.waiting = { resolve, reject }; });
  }
  private async status(expected: number[]) {
    const line = await this.line();
    const code = /^[1-5][0-9]{2} /.test(line) ? Number(line.slice(0, 3)) : undefined;
    if (code === 481 || (this.stage === "AUTH_PASS" && code === 381)) throw new NntpsError("CREDENTIALS_REJECTED", this.stage, code);
    if (code === undefined || !expected.includes(code)) throw new NntpsError("UNAVAILABLE", this.stage, code);
    return line.slice(4);
  }
  private async multiline(maxLines: number, maxBytes: number) {
    const result: string[] = []; let bytes = 0;
    while (true) {
      let line = await this.line();
      if (line === ".") return result;
      if (line.startsWith("..")) line = line.slice(1);
      else if (line.startsWith(".")) throw new NntpsError();
      bytes += line.length + 2;
      if (bytes > maxBytes || result.length >= maxLines) throw new NntpsError();
      result.push(line);
    }
  }

  async groups(): Promise<string[]> {
    return this.run(async () => {
      this.stage = "GROUP_LIST";
      this.send("LIST ACTIVE");
      try { await this.status([215]); }
      catch (error) {
        // Bare LIST defaults to ACTIVE. Retry syntax rejection only, never denial.
        if (!(error instanceof NntpsError) || ![500, 501].includes(error.statusCode ?? 0)) throw error;
        this.send("LIST"); await this.status([215]);
      }
      const lines = await this.multiline(512, 65536);
      this.stage = "GROUP_PARSE";
      const names = lines.map(line => {
        const fields = line.trim().split(/[ \t]+/);
        if (fields.length !== 4 || !groupName(fields[0]) ||
          !fields.slice(1, 3).every(n => /^[0-9]{1,10}$/.test(n) && Number(n) <= 0x7fffffff) ||
          !/^[ynm]$/.test(fields[3])) throw new NntpsError();
        return fields[0];
      });
      if (new Set(names).size !== names.length) throw new NntpsError();
      return names;
    });
  }

  /** Native selection metadata only. This is NOT a ReadACS/eligibility grant. */
  async probeGroup(group: string) {
    return this.run(() => this.select(group), true, true);
  }

  /** Keep an existing native connection alive without reauthenticating it. */
  async ping(): Promise<void> {
    return this.run(async () => {
      this.stage = "CAPABILITIES";
      this.send("CAPABILITIES"); await this.status([101]);
      await this.multiline(64, 8192);
    });
  }

  private async select(group: string) {
    if (!groupName(group)) throw new NntpsError();
    this.stage = "GROUP_SELECT";
    this.send(`GROUP ${group}`);
    const fields = (await this.status([211])).trim().split(/[ \t]+/);
    if (fields.length !== 4 || fields[3] !== group ||
      !fields.slice(0, 3).every(n => /^[0-9]{1,10}$/.test(n) && Number(n) <= 0x7fffffff)) throw new NntpsError();
    return { count: Number(fields[0]), low: Number(fields[1]), high: Number(fields[2]) };
  }

  async overview(group: string, before?: number, limit = 25) {
    return this.run(async () => {
      if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (before !== undefined && !articleNumber(before))) throw new NntpsError();
      const bounds = await this.select(group);
      const high = Math.min(bounds.high, before === undefined ? bounds.high : before - 1);
      if (!bounds.count || high < bounds.low || high < 1) return { lines: [] as string[], nextBefore: null };
      const low = Math.max(1, bounds.low, high - limit + 1);
      // The verified sandbox advertises the standard OVER capability.
      this.stage = "OVERVIEW";
      this.send(`OVER ${low}-${high}`); await this.status([224]);
      const lines = await this.multiline(limit, 256 * 1024);
      const seen = new Set<number>();
      for (const line of lines) {
        const fields = line.split("\t"); const number = Number(fields[0]);
        if (fields.length < 8 || !articleNumber(number) || !/^[0-9]{1,10}$/.test(fields[0]) || number < low || number > high || seen.has(number)) throw new NntpsError();
        seen.add(number);
      }
      return { lines, nextBefore: low > Math.max(bounds.low, 1) ? low : null };
    });
  }

  async article(group: string, number: number): Promise<string[]> {
    return this.run(async () => {
      if (!articleNumber(number)) throw new NntpsError();
      const bounds = await this.select(group);
      if (!bounds.count || number < bounds.low || number > bounds.high) throw new NntpsError();
      // Numeric addressing after GROUP prevents cross-area Message-ID lookups.
      this.stage = "ARTICLE";
      this.send(`ARTICLE ${number}`);
      const fields = (await this.status([220])).split(/ +/);
      if (fields[0] !== String(number)) throw new NntpsError();
      return this.multiline(10000, 512 * 1024);
    });
  }
}
