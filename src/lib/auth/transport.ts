import "server-only";
import https from "node:https";
import type { NativeProvider, NativeRequest } from "./native";

/** Private mTLS transport. Certificates/keys are operator supplied in memory.
 * No redirects, ambient proxy, retries, request logging or credential files.
 * This transport does not prove that the remote driver has correct semantics.
 */
export class BridgeTransport implements NativeProvider {
  private active = 0;
  private readonly endpoint: URL;
  constructor(url: string, private readonly tls: { ca: Buffer; cert: Buffer; key: Buffer }) {
    this.endpoint = new URL(url);
    if (this.endpoint.protocol !== "https:" || this.endpoint.username || this.endpoint.password ||
      this.endpoint.search || this.endpoint.hash || this.endpoint.pathname !== "/v1/native" ||
      !tls.ca.length || !tls.cert.length || !tls.key.length) throw new Error("Bridge unavailable");
  }
  async request(data: NativeRequest, { signal }: { signal: AbortSignal }): Promise<unknown> {
    if (signal.aborted || this.active >= 8) throw new Error("Bridge unavailable");
    const body = Buffer.from(JSON.stringify(data));
    if (body.length > 4096) throw new Error("Bridge unavailable");
    this.active++;
    try {
      return await new Promise((resolve, reject) => {
        const fail = () => reject(new Error("Bridge unavailable"));
        const req = https.request(this.endpoint, {
          method: "POST", ...this.tls, rejectUnauthorized: true, minVersion: "TLSv1.2",
          agent: false, signal, timeout: 1200, maxHeaderSize: 4096,
          headers: { "content-type": "application/json", "content-length": body.length },
        }, res => {
          if (res.statusCode !== 200 || res.headers["content-type"] !== "application/json" ||
            res.headers["content-encoding"]) { res.destroy(); fail(); return; }
          const chunks: Buffer[] = []; let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 4096) { res.destroy(); fail(); } else chunks.push(chunk);
          });
          res.on("error", fail);
          res.on("end", () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { fail(); }
          });
        });
        req.on("error", fail);
        req.on("timeout", () => req.destroy());
        req.end(body);
      });
    } catch { throw new Error("Bridge unavailable"); }
    finally { body.fill(0); this.active--; }
  }
}
