import "server-only";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { createPrivateKey, X509Certificate } from "node:crypto";
import { BridgeTransport } from "./transport";

type Environment = Record<string, string | undefined>;
type GatewaySettings = {
  instance: string;
  url: string;
  caFile: string;
  certFile: string;
  keyFile: string;
};
const VARIABLES = ["MYSTIC_GATEWAY_INSTANCE", "MYSTIC_GATEWAY_URL", "MYSTIC_GATEWAY_CA_FILE",
  "MYSTIC_GATEWAY_CERT_FILE", "MYSTIC_GATEWAY_KEY_FILE"] as const;

function unavailable(): never { throw new Error("Gateway configuration unavailable"); }

/** Server-side settings only. File paths reference certificates, never BBS passwords. */
export function gatewaySettings(env: Environment): GatewaySettings | null {
  if (!VARIABLES.some(name => env[name] !== undefined)) return null;
  const values = VARIABLES.map(name => env[name]);
  if (values.some(value => typeof value !== "string" || !value || value.length > 2048 || /[\x00-\x1f\x7f]/.test(value))) unavailable();
  const [instance, url, caFile, certFile, keyFile] = values as string[];
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(instance)) unavailable();
  try {
    const target = new URL(url);
    if (target.protocol !== "https:" || !target.hostname || target.username || target.password ||
      target.search || target.hash || target.pathname !== "/v1/native" ||
      target.origin + target.pathname !== url) unavailable();
  } catch { unavailable(); }
  if ([caFile, certFile, keyFile].some(filename => !path.isAbsolute(filename))) unavailable();
  return { instance, url, caFile, certFile, keyFile };
}

async function certificateFile(filename: string, privateKey = false): Promise<Buffer> {
  // These are administrator-managed configuration files, not native BBS paths.
  // Enforce regular files, no linked ancestors and bounded stable reads. On
  // Windows, equivalent access restrictions require administrator-managed ACLs.
  for (let current = path.resolve(filename); ; current = path.dirname(current)) {
    if ((await lstat(current)).isSymbolicLink()) unavailable();
    if (current === path.dirname(current)) break;
  }
  const file = await open(filename, "r");
  try {
    const before = await file.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size < 1 || before.size > 65536 ||
      (process.platform !== "win32" && ((before.mode & 0o022) || (privateKey && (before.mode & 0o037))))) unavailable();
    const bytes = Buffer.alloc(before.size);
    if ((await file.read(bytes, 0, bytes.length, 0)).bytesRead !== bytes.length) unavailable();
    const after = await file.stat(), current = await lstat(filename), resolved = await realpath(filename);
    const samePath = process.platform === "win32" ? resolved.toLowerCase() === path.resolve(filename).toLowerCase() : resolved === path.resolve(filename);
    if (!samePath || current.isSymbolicLink() || current.dev !== before.dev || current.ino !== before.ino ||
      before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) unavailable();
    return bytes;
  } finally { await file.close(); }
}

/** Creates an unconnected mTLS provider. This does not enable native/web access,
 * establish server trust by itself, or replace the runtime certification gates. */
export async function gatewayIdentity(settings: Pick<GatewaySettings, "caFile" | "certFile" | "keyFile">): Promise<{
  ca: Buffer; cert: Buffer; key: Buffer;
}> {
  let key: Buffer | undefined;
  try {
    const ca = await certificateFile(settings.caFile), cert = await certificateFile(settings.certFile);
    key = await certificateFile(settings.keyFile, true);
    const authority = new X509Certificate(ca), identity = new X509Certificate(cert);
    if (!authority.ca || identity.ca || !identity.checkPrivateKey(createPrivateKey(key))) unavailable();
    return { ca, cert, key };
  } catch {
    key?.fill(0);
    unavailable();
  }
}

export async function configuredGateway(env: Environment = process.env): Promise<{
  instance: string; provider: BridgeTransport;
} | null> {
  const settings = gatewaySettings(env);
  if (!settings) return null;
  const identity = await gatewayIdentity(settings);
  try { return { instance: settings.instance, provider: new BridgeTransport(settings.url, identity) }; }
  catch { identity.key.fill(0); unavailable(); }
}
