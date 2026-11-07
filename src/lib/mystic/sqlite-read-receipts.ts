import "server-only";
import path from "node:path";
import { AuthStore } from "../auth/store";
import { readUserMessageReceipt } from "./message-sidecar";

/** Import a legacy JSON sidecar on demand, retaining it for rollback.
 * SQLite is the sole read/write source after import. Re-import is idempotent.
 */
export async function loadMessageReceipts(db: string, instance: string, area: number, user: number) {
  const metadataRoot = path.join(path.dirname(db), "mysticweb-message-metadata");
  const legacy = await readUserMessageReceipt(metadataRoot, instance, area, user);
  const store = new AuthStore(db);
  try {
    if (legacy) store.importMessageReceipts(instance, area, user, legacy.messages, legacy.lastReadJamNumber);
    return store.readMessageReceipts(instance, area, user);
  } finally { store.close(); }
}

export async function saveMessageRead(db: string, instance: string, area: number, user: number, id: string) {
  // Preserve any legacy read timestamps before inserting the new receipt.
  await loadMessageReceipts(db, instance, area, user);
  const store = new AuthStore(db);
  try { store.recordMessageRead(instance, area, user, id); }
  finally { store.close(); }
}
