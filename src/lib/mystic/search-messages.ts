import "server-only";
import { readJam } from "./jam";

/** Unicode-aware, case-insensitive matching with a small typo tolerance.
 * Fuzzy matching is limited to individual words to avoid unrelated matches.
 */
export function matchesMessageSearch(value: string, search: string): boolean {
  const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("en-US");
  const haystack = normalize(value);
  const needle = normalize(search.trim());
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  const words = haystack.match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = needle.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!terms.length) return false;
  const similar = (a: string, b: string): boolean => {
    if (a === b || a.includes(b)) return true;
    if (b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
    // One insertion, deletion, substitution or adjacent transposition.
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (i + 1 < a.length && j + 1 < b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) {
        i += 2; j += 2; continue;
      }
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    }
    return edits + Number(i < a.length || j < b.length) <= 1;
  };
  return terms.every(term => words.some(word => similar(word, term)));
}

export interface SearchArea {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  jamBase: string;
}
export interface SearchResult {
  areaId: number;
  areaName: string;
  groupId: number;
  groupName: string;
  number: number;
  author: string;
  recipient: string;
  subject: string;
  written: number;
}
export interface SearchMessagesResponse {
  results: SearchResult[];
  truncated: boolean;
  scannedAreas: number;
}

/** Bounded, header-only search. Caller MUST supply exclusively authorized
 * areas, freshly checked against the current native account and area allowlist.
 * Never expose this function directly to unauthenticated routes.
 */
export async function searchMessages(
  searchString: string,
  groupName: string,
  allGroups: boolean,
  authorizedAreas: readonly SearchArea[],
  jamRoot: string,
): Promise<SearchMessagesResponse> {
  const query = typeof searchString === "string" ? searchString.trim() : "";
  if (typeof searchString !== "string" || query.length < 2 || query.length > 120 ||
      typeof groupName !== "string" || groupName.length > 60 ||
      typeof allGroups !== "boolean") throw new Error("Invalid search");
  const candidates = authorizedAreas.filter(area => allGroups || area.groupName === groupName);
  if (!allGroups && !groupName) throw new Error("Group required");
  const results: SearchResult[] = [];
  let scannedAreas = 0;
  const MAX_AREAS = 20;
  const MAX_PAGES = 4;
  const MAX_RESULTS = 50;
  let truncated = candidates.length > MAX_AREAS;
  for (const area of candidates.slice(0, MAX_AREAS)) {
    scannedAreas++;
    let before: number | undefined;
    for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
      const page = await readJam(jamRoot, area.jamBase, { limit: 50, ...(before ? { before } : {}) });
      for (const message of page.messages) {
        if ([message.subject, message.author, message.recipient].some(value => matchesMessageSearch(value, query))) {
          results.push({
            areaId: area.id, areaName: area.name, groupId: area.groupId, groupName: area.groupName,
            number: message.number, author: message.author, recipient: message.recipient,
            subject: message.subject, written: message.dates.written,
          });
          if (results.length === MAX_RESULTS) return { results, truncated: true, scannedAreas };
        }
      }
      if (page.nextBefore === null) break;
      before = page.nextBefore;
      if (pageIndex === MAX_PAGES - 1) truncated = true;
    }
  }
  return { results, truncated, scannedAreas };
}
