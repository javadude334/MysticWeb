"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Area = { id: number; name: string; groupIds: number[] };
type Group = { id: number; name: string };
type Message = { number: number; author: string; recipient: string; subject: string; body?: string; dates: { written: number }; replyTo?: number; firstReply?: number; nextReply?: number };
type Page = { area: Area; messages: Message[]; nextBefore: number | null };

function validArea(value: unknown): value is Area {
  return !!value && typeof value === "object" && Number.isSafeInteger((value as Area).id) &&
    (value as Area).id > 0 && typeof (value as Area).name === "string" &&
    Array.isArray((value as Area).groupIds) && (value as Area).groupIds.every(id => Number.isSafeInteger(id) && id > 0);
}
function validPage(value: unknown): value is Page {
  if (!value || typeof value !== "object") return false;
  const page = value as Page;
  return validArea(page.area) && Array.isArray(page.messages) && page.messages.length <= 50 &&
    (page.nextBefore === null || (Number.isSafeInteger(page.nextBefore) && page.nextBefore > 0)) &&
    page.messages.every(m => Number.isSafeInteger(m.number) && m.number > 0 &&
      typeof m.author === "string" && typeof m.recipient === "string" && typeof m.subject === "string" &&
      (m.body === undefined || typeof m.body === "string"));
}
async function getJSON(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error("Message access is not available for this account.");
  return response.json();
}

/** Read-only public echo reader. Server owns authentication and every authorization decision. */
export function MessageWorkspace() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<number[]>([]);
  const [area, setArea] = useState<Area | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
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
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Messages unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const load = useCallback((chosen: Area, before?: number) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError("");
    const params = new URLSearchParams({ area: String(chosen.id), limit: "25" });
    if (before !== undefined) params.set("before", String(before));
    getJSON("/api/messages?" + params.toString(), controller.signal).then(value => {
      if (!validPage(value) || value.area.id !== chosen.id) throw new Error("Invalid message response.");
      setPage(value); setSelected(null);
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
  const filtered = page?.messages.filter(message => {
    const query = search.trim().toLocaleLowerCase();
    return !query || [message.subject, message.author, message.recipient].some(value => value.toLocaleLowerCase().includes(query));
  }) ?? [];
  return <div className="mw-mail">
    <div className="mw-toolbar">
      <div><strong>Message Center</strong><span>Public message areas</span></div>
      <label className="mw-search"><span className="sr-only">Search loaded messages</span>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Search loaded subjects and senders…" aria-label="Search loaded messages" />
      </label>
      <button type="button" onClick={() => { setNotice("Posting will be available after the native Mystic writer and permissions are connected."); }}
        aria-label="New post (not yet available)">+ New Post</button>
    </div>
    {notice && <p className="mw-notice" role="status">{notice} <button type="button" onClick={() => setNotice("")}>Dismiss</button></p>}
    <div className="mw-mail-grid">
      <aside className="mw-folders" aria-label="Message areas">
        <div className="mw-folders-heading"><strong>Folders</strong>
          <button type="button" onClick={() => { setArea(null); setPage(null); setSelected(null); setRefresh(v => v + 1); }}>Refresh</button>
        </div>
        {groups.map(group => {
          const members = areas.filter(item => item.groupIds.includes(group.id));
          const expanded = !collapsedGroups.includes(group.id);
          return <div key={group.id}>
            <button type="button" className="mw-folder-toggle" aria-expanded={expanded}
              onClick={() => setCollapsedGroups(current => expanded ? [...current, group.id] : current.filter(id => id !== group.id))}>
              <span aria-hidden="true">{expanded ? "▾" : "▸"}</span> {group.name} <span>({members.length})</span>
            </button>
            {expanded && <div className="mw-area-list">{members.map(item =>
              <button type="button" key={item.id} aria-current={area?.id === item.id ? "page" : undefined}
                className={area?.id === item.id ? "mw-active" : ""}
                onClick={() => { requestRef.current?.abort(); setPage(null); setSelected(null); setSearch(""); setArea(item); }}>
                {item.name}
              </button>)}</div>}
          </div>;
        })}
        {!loading && !error && areas.length === 0 && <p>No accessible message areas.</p>}
      </aside>
      <section className="mw-message-list" aria-label="Message list">
        <div className="mw-pane-heading"><strong>{area?.name ?? "Select a message area"}</strong>
          <span>{page ? `${page.messages.length} loaded` : "Messages"}</span>
        </div>
        {loading && <p role="status">Loading messages…</p>}
        {error && <p role="alert">{error}</p>}
        {!area && !loading && <p>Choose a message area on the left.</p>}
        {page && <div className="mw-thread-list">
          {filtered.map(message => <button type="button" key={message.number}
            className={selected?.number === message.number ? "mw-active" : ""}
            aria-current={selected?.number === message.number ? "true" : undefined}
            onClick={() => openMessage(message)}>
            <span className="mw-thread-from">{message.author}</span>
            <strong>{message.subject || "(No subject)"}</strong>
            <span>To: {message.recipient} · #{message.number}</span>
          </button>)}
          {filtered.length === 0 && <p>{search ? "No matches among loaded messages." : "No messages in this page."}</p>}
          {page.nextBefore !== null && <button type="button" className="mw-load-more" disabled={loading}
            onClick={() => { if (area && page.nextBefore !== null) load(area, page.nextBefore); }}>Older messages</button>}
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
          <p className="mw-message-meta"><strong>{selected.author}</strong> → {selected.recipient} · Message #{selected.number}</p>
          <pre>{selected.body ?? "Message body not loaded."}</pre>
          <div className="mw-replies">
            {([["Parent", selected.replyTo], ["First reply", selected.firstReply], ["Next reply", selected.nextReply]] as const)
              .map(([label, number]) => typeof number === "number" && Number.isSafeInteger(number) && number > 0
                ? <button type="button" key={label} disabled={loading}
                    onClick={() => openMessage({ number })}>{label} #{number}</button> : null)}
          </div>
        </article>}
      </section>
    </div>
    <p className="mw-footnote">Search covers loaded message headers only. Full-text and cross-area search will require a server-side search service.</p>
  </div>;
}
