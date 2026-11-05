/**
 * Initialize the trusted Mystic configuration and private SQLite database
 * during Node server startup, before accepting sandbox authentication.
 * Production native authentication remains separately gated.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" ||
      process.env.NODE_ENV !== "development") return;
  const { initializeMysticWebRuntime } = await import("./lib/storage/runtime");
  initializeMysticWebRuntime();
}
