"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MysticText } from "@/components/mystic-text";

type Area = { id: number; name: string; groupIds: number[] };
type Group = { id: number; name: string };
type Message = { number: number; author: string; recipient: string; subject: string; body?: string; dates: { written: number }; replyTo?: number; firstReply?: number; nextReply?: number };
type Page = { area: Area; messages: Message[]; nextBefore: number | null };

function formatMysticDate(timestamp: number | undefined): string {
  if (!Number.isSafeInteger(timestamp) || !timestamp || timestamp < 0 || timestamp > 0xffffffff) return "Date unavailable";
  // JAM timestamps are BBS-local wall times; avoid asserting a timezone.
  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime()) ? "Date unavailable" :
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} (BBS time)`;
}
function validArea(value: unknown): value is Area {
  return !!value && typeof value === "object" && Number.isSafeInteger((value as Area).id) &&
    (value as Area).id > 0 && typeof (value as Area).name === "string" &&
    Array.isArray((value as Area).groupIds) && (value as Area).groupIds.every(id => Number.isSafeInteger(id) && id > 0);
}
function validPage(value: unknown): value is Page {
  if (!value || typeof value !== "object") return false;
  const page = value as Page;
  return !!page.area && Number.isSafeInteger(page.area.id) && page.area.id > 0 && typeof page.area.name === "string" && Array.isArray(page.messages) && page.messages.length <= 50 &&
    (page.nextBefore === null || (Number.isSafeInteger(page.nextBefore) && page.nextBefore > 0)) &&
    page.messages.every(m => Number.isSafeInteger(m.number) && m.number > 0 &&
      typeof m.author === "string" && typeof m.recipient === "string" && typeof m.subject === "string" &&
      (m.body === undefined || typeof m.body === "string") && !!m.dates &&
      Number.isSafeInteger(m.dates.written) && m.dates.written >= 0 && m.dates.written <= 0xffffffff);
}
async function getJSON(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) {
    if (response.status === 503) throw new Error("The Mystic message service is not connected yet. This is a server configuration issue, not a problem with your account.");
    if (response.status === 401) throw new Error("Your MysticWeb session is not authenticated. Sign in and try again.");
    if (response.status === 403) throw new Error("Your Mystic account does not have permission to access these messages.");
    throw new Error("Message access is unavailable. Please try again later.");
  }
  return response.json();
}

/** Read-only public echo reader. Server owns authentication and every authorization decision. */
export function MessageWorkspace() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [pageHistory, setPageHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [searchAllGroups, setSearchAllGroups] = useState(false);
  const [notice, setNotice] = useState("");
  const [searchResults, setSearchResults] = useState<{ areaId: number; areaName: string; groupName: string; number: number; author: string; subject: string; matchedField: "subject" | "sender" | "body"; excerpt?: string }[] | null>(null);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<AbortController | null>(null);
  const pendingSearchMessage = useRef<{ areaId: number; number: number } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    // Schedule the request state transition outside the effect body.
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setLoading(true); setError(""); setAreas([]); setGroups([]);
      return getJSON("/api/messages", controller.signal);
    }).then(value => {
      if (controller.signal.aborted || value === undefined) return;
      if (!value || typeof value !== "object" || !("areas" in value) || !Array.isArray(value.areas) || value.areas.length > 512 || !value.areas.every(validArea) || !("groups" in value) || !Array.isArray(value.groups) || value.groups.length > 128 || !value.groups.every((g: unknown) => !!g && typeof g === "object" && Number.isSafeInteger((g as Group).id) && (g as Group).id > 0 && typeof (g as Group).name === "string")) throw new Error("Invalid area catalog.");
      setAreas(value.areas as Area[]);
      setGroups(value.groups as Group[]);
      setSelectedGroupId(current => (value.groups as Group[]).some(group => group.id === current) ? current : null);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Messages unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const load = useCallback((chosen: Area, before?: number, history: number[] = []) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError("");
    const params = new URLSearchParams({ area: String(chosen.id), limit: "25" });
    if (before !== undefined) params.set("before", String(before));
    getJSON("/api/messages?" + params.toString(), controller.signal).then(value => {
      if (!validPage(value) || value.area.id !== chosen.id) throw new Error("Invalid message response.");
      setPage(value); setSelected(null); setPageHistory(history);
      const pending = pendingSearchMessage.current;
      if (pending?.areaId === chosen.id) {
        pendingSearchMessage.current = null;
        // The message may be older than the loaded page; fetch by JAM number.
        const messageParams = new URLSearchParams({ area: String(chosen.id), message: String(pending.number) });
        getJSON("/api/messages?" + messageParams, controller.signal).then(detail => {
          if (!validPage(detail) || detail.area.id !== chosen.id || detail.messages.length !== 1 ||
              detail.messages[0].number !== pending.number || typeof detail.messages[0].body !== "string")
            throw new Error("Search result message unavailable.");
          if (!controller.signal.aborted) setSelected(detail.messages[0]);
        }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Message unavailable."); });
      }
    }).catch(e => { if (!controller.signal.aborted) { setPage(null); setSelected(null); setError(e instanceof Error ? e.message : "Messages unavailable."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!area) return;
    // A microtask keeps state changes out of the synchronous effect body.
    let active = true;
    let cancel: (() => void) | undefined;
    Promise.resolve().then(() => {
      if (active) cancel = load(area);
    });
    return () => { active = false; cancel?.(); };
  }, [area, load]);
  const openMessage = (message: Pick<Message, "number">) => {
    if (!area) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setSelected(null); setError(""); setLoading(true);
    const params = new URLSearchParams({ area: String(area.id), message: String(message.number) });
    getJSON("/api/messages?" + params, controller.signal).then(value => {
      if (!validPage(value) || value.area.id !== area.id || value.messages.length !== 1 ||
          value.messages[0].number !== message.number || typeof value.messages[0].body !== "string")
        throw new Error("Message unavailable.");
      setSelected(value.messages[0]);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Message unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  };
  const runSearch = () => {
    searchRef.current?.abort();
    if (search.trim().length < 2 || (!searchAllGroups && selectedGroupId === null)) {
      setError("Enter at least two characters and select a message group.");
      return;
    }
    const controller = new AbortController();
    searchRef.current = controller;
    setSearching(true); setError(""); setSelected(null); setSearchResults(null);
    const groupName = groups.find(group => group.id === selectedGroupId)?.name ?? "";
    const params = new URLSearchParams({ search: search.trim(), groupName, allGroups: String(searchAllGroups) });
    getJSON("/api/messages?" + params, controller.signal).then(value => {
      if (!value || typeof value !== "object" || !("results" in value) ||
          !Array.isArray(value.results) || value.results.length > 50)
        throw new Error("Invalid search response.");
      setSearchResults(value.results);
      setSearchTruncated("truncated" in value && value.truncated === true);
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Search unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setSearching(false); });
  };
  const filtered = page?.messages.filter(message => {
    const query = search.trim().toLocaleLowerCase();
    return !query || [message.subject, message.author, message.recipient].some(value => value.toLocaleLowerCase().includes(query));
  }) ?? [];
  return <div className="mw-mail">
    <div className="mw-toolbar">
      <div><strong>Message Center</strong><span>Public message areas</span></div>
    </div>
    <div className="mw-toolbar">
      <div className="mw-group-control">
        <label htmlFor="mw-group-select">Message group</label>
        <select id="mw-group-select" value={selectedGroupId ?? ""} disabled={groups.length === 0}
          onChange={event => {
            requestRef.current?.abort();
            pendingSearchMessage.current = null;
            setSearchResults(null);
            setSelectedGroupId(event.target.value ? Number(event.target.value) : null);
            setArea(null); setPage(null); setSelected(null); setPageHistory([]); setSearch(""); setError("");
          }}>
          <option value="">Select a message group</option>
          {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </div>
      <div className="mw-search-container" style={{ display: "flex", flexDirection: "column", flex: "1 1 320px", minWidth: 0, gap: "8px" }}>
        <label className="mw-search"><span>Search</span>
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setSearchResults(null); }}
            placeholder="Search subjects, senders, and bodies…" aria-label="Search" />
        </label>
        <label className="mw-search-scope" style={{ alignSelf: "flex-start" }}><input type="checkbox" checked={searchAllGroups} onChange={event => { setSearchAllGroups(event.target.checked); setSearchResults(null); }} /> Search all groups</label>
      </div>
      <button type="button" disabled={searching} onClick={runSearch}>{searching ? "Searching…" : "Search"}</button>
      <button type="button" onClick={() => { setNotice("Posting will be available after the native Mystic writer and permissions are connected."); }}
        aria-label="New post (not yet available)">+ New Post</button>
    </div>
    {notice && <p className="mw-notice" role="status">{notice} <button type="button" onClick={() => setNotice("")}>Dismiss</button></p>}
    <div className="mw-mail-grid">
      <aside className="mw-folders" aria-label="Message areas">
        <div className="mw-folders-heading"><strong>Message Areas</strong>
          <button type="button" onClick={() => { setArea(null); setPage(null); setSelected(null); setPageHistory([]); setRefresh(v => v + 1); }}>Refresh</button>
        </div>
        <div className="mw-area-list" aria-label="Areas in selected group">
          {selectedGroupId !== null && areas.filter(item => item.groupIds.includes(selectedGroupId)).map(item =>
            <button type="button" key={item.id} aria-current={area?.id === item.id ? "page" : undefined}
              className={area?.id === item.id ? "mw-active" : ""}
              onClick={() => { requestRef.current?.abort(); pendingSearchMessage.current = null; setSearchResults(null); setPage(null); setSelected(null); setPageHistory([]); setSearch(""); setArea(item); }}>
              {item.name}
            </button>)}
          {selectedGroupId === null && <p>Select a group to see its message areas.</p>}
          {selectedGroupId !== null && !areas.some(item => item.groupIds.includes(selectedGroupId)) && <p>No accessible areas in this group.</p>}
        </div>
        {!loading && !error && areas.length === 0 && <p>No accessible message areas.</p>}
      </aside>
      <section className="mw-message-list" aria-label="Message list">
        <div className="mw-pane-heading"><strong>{area?.name ?? "Select a message area"}</strong>
          <span>{page ? `${page.messages.length} loaded` : "Messages"}</span>
        </div>
        {loading && <p role="status">Loading messages…</p>}
        {error && <p role="alert">{error}</p>}
        {!area && !loading && !error && <p>Choose a message area on the left.</p>}
        {searchResults && <div className="mw-thread-list" aria-label="Search results">
          <strong>{searchResults.length} search results{searchTruncated ? " (limited scan)" : ""}</strong>
          {searchResults.map(result => <button type="button" key={result.areaId + ":" + result.number}
            onClick={() => {
              const chosen = areas.find(item => item.id === result.areaId);
              if (!chosen) return;
              // Keep the search results visible while the message opens.
              // Selecting a result from the already-open area does not change
              // area state, so its load effect will not run again.
              if (area?.id === chosen.id) {
                openMessage({ number: result.number });
              } else {
                pendingSearchMessage.current = { areaId: result.areaId, number: result.number };
                setSelectedGroupId(chosen.groupIds[0] ?? null);
                setArea(chosen);
                setPage(null);
                setSelected(null);
              }
            }}>
            <strong>{result.subject || "(No subject)"}</strong>
            <span>{result.author} · {result.groupName} / {result.areaName} · #{result.number} · Match: {result.matchedField}</span>
            {result.excerpt && <span><MysticText text={result.excerpt} /></span>}
          </button>)}
          {!searchResults.length && <p>No matching headers in the scanned messages.</p>}
        </div>}
        {!searchResults && page && <div className="mw-thread-list">
          {filtered.map(message => <button type="button" key={message.number}
            className={selected?.number === message.number ? "mw-active" : ""}
            aria-current={selected?.number === message.number ? "true" : undefined}
            onClick={() => openMessage(message)}>
            <span className="mw-thread-from">{message.author}</span>
            <strong>{message.subject || "(No subject)"}</strong>
            <span>To: {message.recipient} · #{message.number} · {formatMysticDate(message.dates.written)}</span>
          </button>)}
          {filtered.length === 0 && <p>{search ? "No matches among loaded messages." : "No messages in this page."}</p>}
          {pageHistory.length > 0 && <button type="button" className="mw-load-more" disabled={loading}
            onClick={() => { if (area) { const previous = pageHistory.slice(0, -1); load(area, previous.at(-1) || undefined, previous); } }}>Newer messages</button>}
          {page.nextBefore !== null && <button type="button" className="mw-load-more" disabled={loading}
            onClick={() => { if (area && page.nextBefore !== null) load(area, page.nextBefore, [...pageHistory, page.nextBefore]); }}>Older messages</button>}
        </div>}
      </section>
      <section className="mw-reading-pane" aria-label="Message reader">
        {!selected && <div className="mw-reader-empty"><strong>No message selected</strong>
          <p>Select a message to read it here.</p></div>}
        {selected && <article className="mw-message">
          <div className="mw-message-actions">
            <button type="button" onClick={() => setNotice("Reply requires the native Mystic posting service, which is not connected yet.")}>↩ Reply</button>
          </div>
          <h2>{selected.subject || "(No subject)"}</h2>
          <p className="mw-message-meta"><strong>{selected.author}</strong> → {selected.recipient} · Message #{selected.number} · {formatMysticDate(selected.dates.written)}</p>
          <pre><MysticText text={selected.body ?? "Message body not loaded."} /></pre>
          <div className="mw-replies">
            {([["Parent", selected.replyTo], ["First reply", selected.firstReply], ["Next reply", selected.nextReply]] as const)
              .map(([label, number]) => typeof number === "number" && Number.isSafeInteger(number) && number > 0
                ? <button type="button" key={label} disabled={loading}
                    onClick={() => openMessage({ number })}>{label} #{number}</button> : null)}
          </div>
        </article>}
      </section>
    </div>
    <p className="mw-footnote">Search checks subjects, senders and message bodies in a bounded sample of authorized message areas. Limited scans are marked; search is not yet a complete archive index.</p>
  </div>;
}
