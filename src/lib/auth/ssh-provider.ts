import "server-only";
import { NativeSshSession, type NativeSshEndpoint } from "./ssh-session";
import type { NativeProvider, NativeRequest } from "./native";

/**
 * Sandbox-only native SSH provider, deliberately not wired into productionAccess.
 * The password is used only for SSH authentication and is never included in
 * the worker's JSON request. A missing native worker, failed host pin, or
 * invalid native reply cannot become a browser session.
 *
 * This adapter supports the initial authentication operation only. Subsequent
 * account and ACS checks require a separately verified native session design;
 * they fail closed until that design is implemented.
 */
export class SandboxSshProvider implements NativeProvider {
  constructor(private readonly endpoint: NativeSshEndpoint) {}

  async request(request: NativeRequest, options: { signal: AbortSignal }): Promise<unknown> {
    if (request.operation !== "authenticate" || options.signal.aborted) {
      throw new Error("Native connection unavailable");
    }
    const { username, password, ...metadata } = request;
    const session = await NativeSshSession.connect(
      this.endpoint, username, password, options.signal,
    );
    try {
      if (options.signal.aborted) throw new Error("Native connection unavailable");
      return await session.request(metadata, options.signal);
    } finally {
      session.close();
    }
  }
}
