import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { Client, type ClientChannel } from "ssh2";

export type NativeSshEndpoint = {
  host: string;
  port: number;
  hostKeySha256: string;
  // Explicit compatibility choice for a Windows-local sandbox gateway only.
  // Absent by default. Never permit a remote-host legacy cipher fallback.
  localCompatibility?: "aes256-cbc";
};

export class NativeSshError extends Error {
  constructor(public readonly stage: "CONNECT" | "HOST_KEY" | "AUTHENTICATE" | "BRIDGE" | "REQUEST") {
    super("Native connection unavailable");
  }
}

/** One encrypted native session per browser login. SSH authentication alone is
 * NOT a web identity/eligibility grant. The caller must validate a native bridge
 * reply through NativeAccess before issuing a cookie. No production composition.
 */
export class NativeSshSession {
  private channel?: ClientChannel;
  private buffer = "";
  private closed = false;
  private busy = false;
  private ready = false;
  private onReady?: () => void;
  private pending?: { nonce: string; resolve: (value: unknown) => void; reject: () => void };

  private constructor(private readonly client: Client) {}

  static async connect(endpoint: NativeSshEndpoint, username: string, password: string,
    signal: AbortSignal): Promise<NativeSshSession> {
    if (!endpoint.host || !Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535 ||
      !/^[a-f0-9]{64}$/.test(endpoint.hostKeySha256) ||
      (endpoint.localCompatibility !== undefined &&
        (endpoint.localCompatibility !== "aes256-cbc" || endpoint.host !== "127.0.0.1")) ||
      !username || !password || Buffer.byteLength(username) > 120 || Buffer.byteLength(password) > 256 ||
      /[\x00-\x1f\x7f]/.test(username + password) || signal.aborted) throw new NativeSshError("CONNECT");
    const client = new Client(), session = new NativeSshSession(client);
    let stage: NativeSshError["stage"] = "CONNECT";
    // The auth callback drops its credential reference after one attempt. Do not
    // set ssh2's persistent password config or enable debug/terminal logging.
    let candidate = password;
    let authAttempt: { type: "password"; username: string; password: string } | undefined;
    password = "";
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = () => fail();
        const timer = setTimeout(() => fail(), 8000);
        const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
        const fail = () => { cleanup(); session.close(); reject(new NativeSshError(stage)); };
        signal.addEventListener("abort", abort, { once: true });
        client.once("error", fail);
        client.once("close", fail);
        client.once("ready", () => {
          candidate = "";
          if (authAttempt) authAttempt.password = "";
          stage = "BRIDGE";
          client.shell({ term: "ansi", cols: 80, rows: 25 }, (error, channel) => {
            if (error || signal.aborted || session.closed) { channel?.destroy(); fail(); return; }
            session.channel = channel;
            channel.on("data", (bytes: Buffer) => session.receive(bytes));
            channel.stderr.on("data", () => session.close());
            channel.on("error", () => session.close());
            channel.on("close", () => session.close());
            // A bridge-only native start menu must invoke the worker itself.
            // Never navigate user menus or infer success from a welcome screen.
            session.onReady = () => { cleanup(); resolve(); };
            // Mystic waits for this initial terminal input before detection.
            // This does not answer login, new-user, password-change or menu prompts.
            channel.write("\r");
          });
        });
        client.connect({ host: endpoint.host, port: endpoint.port, username,
          ...(endpoint.localCompatibility ? { algorithms: { cipher: [endpoint.localCompatibility] } } : {}),
          readyTimeout: 7000, keepaliveInterval: 10000, keepaliveCountMax: 2,
          hostVerifier: (key: Buffer) => {
            const actual = createHash("sha256").update(key).digest();
            const expected = Buffer.from(endpoint.hostKeySha256, "hex");
            const accepted = timingSafeEqual(actual, expected);
            stage = accepted ? "AUTHENTICATE" : "HOST_KEY";
            return accepted;
          },
          authHandler: (_methods, _partial, next) => {
            if (!candidate) { fail(); return; }
            authAttempt = { type: "password", username, password: candidate };
            candidate = "";
            next(authAttempt);
          },
        });
      });
      return session;
    } catch { session.close(); throw new NativeSshError(stage); }
    finally { candidate = ""; if (authAttempt) authAttempt.password = ""; }
  }

  private receive(bytes: Buffer) {
    if (this.closed) return;
    if (this.ready && [...bytes].some(value => value > 127 || (value < 32 && value !== 10 && value !== 13))) {
      this.close(); return;
    }
    this.buffer += bytes.toString("latin1");
    if (this.buffer.length > 8192) { this.close(); return; }
    if (!this.ready && this.buffer.includes("\x1b[6n")) {
      this.channel?.write("\x1b[25;80R");
      this.buffer = this.buffer.replace(/\x1b\[6n/g, "");
    }
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (!this.ready) {
        if (line === "MYSTICWEB/1 READY") {
          this.ready = true;
          this.onReady?.();
          this.onReady = undefined;
        }
        continue;
      }
      // A dedicated native bridge speaks framed JSON only; arbitrary terminal
      // output or echoed requests cannot become a verified native response.
      if (!line) continue;
      if (!line.startsWith("MYSTICWEB/1 ") || !this.pending) { this.close(); return; }
      try {
        const reply = JSON.parse(line.slice(12));
        if (!reply || reply.nonce !== this.pending.nonce) { this.close(); return; }
        const pending = this.pending;
        this.pending = undefined;
        pending.resolve(reply);
      } catch { this.close(); return; }
    }
  }

  async request(data: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    if (this.closed || !this.ready || !this.channel || this.busy || signal.aborted ||
      typeof data.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.nonce) ||
      Object.hasOwn(data, "password")) throw new NativeSshError("REQUEST");
    const body = Buffer.from(JSON.stringify(data) + "\n", "utf8");
    if (body.length > 4096) { body.fill(0); throw new NativeSshError("REQUEST"); }
    this.busy = true;
    try {
      return await new Promise((resolve, reject) => {
        const abort = () => this.close();
        const timer = setTimeout(abort, 1500);
        const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
        this.pending = { nonce: data.nonce as string,
          resolve: value => { cleanup(); resolve(value); },
          reject: () => { cleanup(); reject(new NativeSshError("REQUEST")); },
        };
        signal.addEventListener("abort", abort, { once: true });
        this.channel!.write(body);
      });
    } finally { body.fill(0); this.busy = false; }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.buffer = "";
    const pending = this.pending;
    this.pending = undefined;
    pending?.reject();
    this.channel?.destroy();
    this.client.destroy();
  }
}
