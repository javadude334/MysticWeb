import "server-only";
import { readSysopMenuText } from "./sysop-text";

/** Compatibility wrapper for existing news readers. */
export async function readMysticNewsPage(id: string): Promise<string | null> {
  return readSysopMenuText("news", id);
}
