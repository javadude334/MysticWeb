"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MysticText } from "@/components/mystic-text";

type Area = { id: number; name: string; groupIds: number[]; readable?: boolean };
type Group = { id: number; name: string };
type Message = { webRead?: boolean; readPosition?: "after-pointer" | "at-or-before-pointer" | "unknown"; number: number; author: string; recipient: string; subject: string; body?: string; dates: { written: number }; replyTo?: number; firstReply?: number; nextReply?: number };
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
    ((value as Area).readable === undefined || typeof (value as Area).readable === "boolean") &&
    Array.isArray((value as Area).groupIds) && (value as Area).groupIds.every(id => Number.isSafeInteger(id) && id > 0);
}
function validPage(value: unknown): value is Page {
  if (!value || typeof value !== "object") return false;
  const page = value as Page;
  return !!page.area && Number.isSafeInteger(page.area.id) && page.area.id > 0 && typeof page.area.name === "string" && Array.isArray(page.messages) && page.messages.length <= 50 &&
    (page.nextBefore === null || (Number.isSafeInteger(page.nextBefore) && page.nextBefore > 0)) &&
    page.messages.every(m => Number.isSafeInteger(m.number) && m.number > 0 &&
      (m.webRead === undefined || typeof m.webRead === "boolean") &&
      (m.readPosition === undefined || ["after-pointer", "at-or-before-pointer", "unknown"].includes(m.readPosition)) &&
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

/** Authenticated echo workspace; posting is gated by the sandbox server. */
export function MessageWorkspace() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [unreadAreaIds, setUnreadAreaIds] = useState<number[]>([]);
  const [unreadScan, setUnreadScan] = useState(0);
  const [unreadGroupIds, setUnreadGroupIds] = useState<number[]>([]);
  const [area, setArea] = useState<Area | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const selectedHeaderRef = useRef<HTMLButtonElement | null>(null);
  // Visual-only viewed state until native .jlr writes are certified.
  const [viewed, setViewed] = useState<Record<string, true>>({});
  useEffect(() => {
    const list = messageListRef.current;
    const header = selectedHeaderRef.current;
    if (!list || !header || !selected) return;
    // Scroll only the header list, not the browser page or reading pane.
    const listRect = list.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    if (headerRect.top < listRect.top) {
      list.scrollTop += headerRect.top - listRect.top;
    } else if (headerRect.bottom > listRect.bottom) {
      list.scrollTop += headerRect.bottom - listRect.bottom;
    }
  }, [selected, page]);
  const [pageHistory, setPageHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [searchAllGroups, setSearchAllGroups] = useState(false);
  const [notice, setNotice] = useState("");
  const [composer, setComposer] = useState<{ areaId: number; replyTo?: number; recipient: string; subject: string; body: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const confirmDiscard = () => !composer || (!composer.body.trim() && !composer.subject.trim() &&
    (composer.recipient === "All" || composer.recipient === (selected?.author ?? "All"))) ||
    window.confirm("Discard your unfinished message? Your changes will be lost.");
  const cancelComposer = () => {
    if (posting || !confirmDiscard()) return;
    setComposer(null); setPostError("");
  };
  const openComposer = (message?: Message) => {
    if (posting || !confirmDiscard()) return;
    if (!area) { setNotice("Select a message area first."); return; }
    setPostError("");
    setComposer({ areaId: area.id, ...(message ? { replyTo: message.number } : {}), recipient: message?.author ?? "All",
      subject: message ? (/^Re:/i.test(message.subject) ? message.subject : "Re: " + message.subject) : "", body: "" });
  };
  const submitPost = async () => {
    if (!area || !composer || posting) return;
    if (area.id !== composer.areaId) { setPostError("Message area changed. Reopen the composer."); return; }
    if (!composer.recipient.trim() || !composer.subject.trim() || !composer.body.trim()) { setPostError("Complete all fields."); return; }
    setPosting(true); setPostError("");
    try {
      const response = await fetch("/api/messages?action=post", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: area.id, recipient: composer.recipient.trim(), subject: composer.subject.trim(),
          body: composer.body, ...(composer.replyTo ? { replyTo: composer.replyTo } : {}) }) });
      if (!response.ok) throw new Error(response.status === 403 ? "Posting denied for this area." :
        response.status === 401 ? "Session expired. Sign in again." : "Posting unavailable. Your draft is preserved.");
      const receipt: unknown = await response.json();
      if (!receipt || typeof receipt !== "object" || !("posted" in receipt) || receipt.posted !== true ||
          !("number" in receipt) || !Number.isSafeInteger(receipt.number))
        throw new Error("Unverified posting receipt; check the message base before retrying.");
      const number = receipt.number as number;
      setComposer(null); setNotice("Posted message #" + number); setSearchResults(null); setSearch("");
      pendingSearchMessage.current = { areaId: area.id, number }; load(area); setUnreadScan(n => n + 1);
    } catch (error) { setPostError(error instanceof Error ? error.message : "Posting failed."); }
    finally { setPosting(false); }
  };
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
      setSelectedGroupId(current => (value.groups as Group[]).some(group => group.id === current) ? current : ((value.groups as Group[])[0]?.id ?? null));
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Messages unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (selectedGroupId === null) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) setUnreadAreaIds([]);
      return getJSON("/api/messages?unreadGroup=" + selectedGroupId, controller.signal);
    }).then(value => {
      if (controller.signal.aborted || !value || typeof value !== "object") return;
      const result = value as { groupId?: unknown; unreadAreaIds?: unknown };
      if (result.groupId !== selectedGroupId || !Array.isArray(result.unreadAreaIds) ||
          result.unreadAreaIds.length > 512 ||
          !result.unreadAreaIds.every(id => Number.isSafeInteger(id) && id > 0)) return;
      setUnreadAreaIds(result.unreadAreaIds);
    }).catch(() => { /* An unavailable pointer scan must not block reading. */ });
    return () => controller.abort();
  }, [selectedGroupId, refresh, unreadScan]);
  useEffect(() => {
    if (groups.length === 0) return;
    const controller = new AbortController();
    // Reuse the authenticated, bounded per-group unread scan. Keep requests
    // sequential so opening a large catalog does not flood the JAM reader.
    Promise.resolve().then(async () => {
      const unread: number[] = [];
      for (const group of groups) {
        if (controller.signal.aborted) return;
        try {
          const value = await getJSON("/api/messages?unreadGroup=" + group.id, controller.signal);
          if (value && typeof value === "object") {
            const result = value as { groupId?: unknown; unreadAreaIds?: unknown };
            if (result.groupId === group.id && Array.isArray(result.unreadAreaIds) &&
                result.unreadAreaIds.length > 0 && result.unreadAreaIds.length <= 512 &&
                result.unreadAreaIds.every(id => Number.isSafeInteger(id) && id > 0)) {
              unread.push(group.id);
              if (!controller.signal.aborted) setUnreadGroupIds([...unread]);
            }
          }
        } catch {
          if (controller.signal.aborted) return;
          // Unknown state stays in normal order; never label it unread.
        }
      }
    });
    return () => controller.abort();
  }, [groups, unreadScan]);
  const orderedGroups = [...groups].sort((a, b) =>
    Number(unreadGroupIds.includes(b.id)) - Number(unreadGroupIds.includes(a.id)));
  const persistWebRead = (areaId: number, number: number) => {
    // Explicit JSON mutation; native Mystic .jlr is never modified.
    void fetch("/api/messages", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: areaId, message: number }),
    }).then(response => {
      if (!response.ok) throw new Error("Unable to save MysticWeb read status.");
      setViewed(previous => ({ ...previous, [areaId + ":" + number]: true }));
      setUnreadScan(value => value + 1);
      setPage(previous => previous?.area.id === areaId ? {
        ...previous, messages: previous.messages.map(m => m.number === number ? { ...m, webRead: true } : m),
      } : previous);
    }).catch(() => setNotice("Message displayed, but MysticWeb could not save its read status."));
  };
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
          if (!controller.signal.aborted) {
            setSelected(detail.messages[0]);
            persistWebRead(chosen.id, pending.number);
          }
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
      persistWebRead(area.id, message.number);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Message unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  };
  const navigate = (direction: -1 | 1) => {
    if (!page || !selected || loading) return;
    const index = page.messages.findIndex(item => item.number === selected.number);
    const next = page.messages[index + direction];
    if (next) openMessage(next);
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
    <div className="mw-controls">
      <div className="mw-group-control">
        <label htmlFor="mw-group-select">Message group</label>
        <select id="mw-group-select" value={selectedGroupId ?? ""} disabled={groups.length === 0}
          onChange={event => {
            if (posting || !confirmDiscard()) return;
            requestRef.current?.abort();
            // Clear pending search selection through the existing search reset path.
            setSearchResults(null);
            setUnreadAreaIds([]);
            setSelectedGroupId(event.target.value ? Number(event.target.value) : null);
            setArea(null); setPage(null); setSelected(null); setPageHistory([]); setSearch(""); setError("");
          }}>
          <option value="">Select a message group</option>
          {orderedGroups.map(group => <option key={group.id} value={group.id}>{unreadGroupIds.includes(group.id) ? "● " : ""}{group.name}</option>)}
        </select>
      </div>
      <div className="mw-toolbar mw-search-row"><div className="mw-search-container">
        <label className="mw-search"><span>Search</span>
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setSearchResults(null); }}
            placeholder="Search subjects, senders, and bodies…" aria-label="Search" />
        </label>
        <label className="mw-search-scope" style={{ alignSelf: "flex-start" }}><input type="checkbox" checked={searchAllGroups} onChange={event => { setSearchAllGroups(event.target.checked); setSearchResults(null); }} /> Search all groups</label>
      </div>
      <button type="button" disabled={searching} onClick={runSearch}>{searching ? "Searching…" : "Search"}</button>
      <button type="button" disabled={!area || posting} onClick={() => openComposer()}
        aria-label="New post">+ New Post</button></div>
    </div>
    {composer && area && composer.areaId === area.id && <section aria-label="Message composer" style={{ padding: "1rem", border: "1px solid #777", display: "grid", gap: "0.75rem", minWidth: 0, width: "100%", boxSizing: "border-box" }}>
      <h2>{composer.replyTo ? "Reply to #" + composer.replyTo : "New post"} · {area.name}</h2>
      <label style={{ display: "grid", gap: "0.25rem", minWidth: 0 }}>To <input style={{ width: "100%", boxSizing: "border-box", minWidth: 0 }} value={composer.recipient} maxLength={255} onChange={e => setComposer(c => c ? { ...c, recipient: e.target.value } : null)} /></label>
      <label style={{ display: "grid", gap: "0.25rem", minWidth: 0 }}>Subject <input style={{ width: "100%", boxSizing: "border-box", minWidth: 0 }} value={composer.subject} maxLength={255} onChange={e => setComposer(c => c ? { ...c, subject: e.target.value } : null)} /></label>
      <label style={{ display: "grid", gap: "0.25rem", minWidth: 0 }}>Message <textarea style={{ width: "100%", boxSizing: "border-box", minWidth: 0, resize: "vertical" }} rows={12} maxLength={60000} value={composer.body} onChange={e => setComposer(c => c ? { ...c, body: e.target.value } : null)} /></label>
      <small>MysticWeb version signature is added automatically. </small>
      {postError && <p role="alert">{postError}</p>}
      <div className="mw-composer-actions"><button type="button" disabled={posting} onClick={() => void submitPost()}>{posting ? "Posting…" : "Post Message"}</button>
        <button type="button" disabled={posting} onClick={cancelComposer}>Cancel</button></div>
    </section>}
    {notice && <p className="mw-notice" role="status">{notice} <button type="button" onClick={() => setNotice("")}>Dismiss</button></p>}
    <div className="mw-mail-grid">
      <aside className="mw-folders" aria-label="Message areas">
        <div className="mw-folders-heading"><strong>Message Areas</strong>
          <button type="button" onClick={() => { if (posting || !confirmDiscard()) return; setComposer(null); setArea(null); setPage(null); setSelected(null); setPageHistory([]); setRefresh(v => v + 1); }}>Refresh</button>
        </div>
        <div className="mw-area-list" aria-label="Areas in selected group">
          {selectedGroupId !== null && areas.filter(item => item.groupIds.includes(selectedGroupId)).sort((a, b) => Number(unreadAreaIds.includes(b.id)) - Number(unreadAreaIds.includes(a.id))).map(item =>
            <button type="button" key={item.id} aria-current={area?.id === item.id ? "page" : undefined}
              className={area?.id === item.id ? "mw-active" : ""}
              disabled={item.readable === false}
              title={item.readable === false ? "Catalog only: not approved for sandbox reading" : undefined}
              onClick={() => { if (posting || !confirmDiscard()) return; setComposer(null); requestRef.current?.abort(); pendingSearchMessage.current = null; setSearchResults(null); setPage(null); setSelected(null); setPageHistory([]); setSearch(""); setArea(item); }}>
              <span className="mw-area-name">{item.name}</span>{unreadAreaIds.includes(item.id) && <span className="mw-area-unread-dot" role="img" aria-label="New messages" title="New messages since your Mystic last-read pointer" />}{item.readable === false ? " · Restricted" : ""}
            </button>)}
          {selectedGroupId === null && <p>Select a group to see its message areas.</p>}
          {selectedGroupId !== null && !areas.some(item => item.groupIds.includes(selectedGroupId)) && <p>No configured areas in this group.</p>}
        </div>
        {!loading && !error && areas.length === 0 && <p>No configured message areas.</p>}
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
        {!searchResults && page && <div className="mw-thread-list" ref={messageListRef}>
          {filtered.map(message => <button type="button" key={message.number}
            ref={node => { if (selected?.number === message.number) selectedHeaderRef.current = node; }}
            className={[selected?.number === message.number ? "mw-active" : "", viewed[area?.id + ":" + message.number] || message.webRead ? "mw-read" : "mw-unread"].filter(Boolean).join(" ")}
            aria-current={selected?.number === message.number ? "true" : undefined}
            onClick={() => openMessage(message)}>
            <span className="mw-thread-from">{message.author}</span>
            <strong>{message.subject || "(No subject)"}</strong>
            <span>To: {message.recipient} · #{message.number} · {formatMysticDate(message.dates.written)}{viewed[area?.id + ":" + message.number] || message.webRead ? " · Read in MysticWeb" : " · Unread in MysticWeb"}</span>
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
            <button type="button" disabled={loading || !page || page.messages.findIndex(m => m.number === selected.number) <= 0} onClick={() => navigate(-1)}>← Previous</button>
            <button type="button" disabled={loading || !page || page.messages.findIndex(m => m.number === selected.number) < 0 || page.messages.findIndex(m => m.number === selected.number) >= page.messages.length - 1} onClick={() => navigate(1)}>Next →</button>
            {([["Parent", selected.replyTo], ["First reply", selected.firstReply], ["Next reply", selected.nextReply]] as const)
              .map(([label, number]) => typeof number === "number" && Number.isSafeInteger(number) && number > 0
                ? <button type="button" key={label} disabled={loading}
                    onClick={() => openMessage({ number })}>{label} #{number}</button> : null)}
            <button type="button" disabled={posting} onClick={() => openComposer(selected)}>↩ Reply</button>
          </div>
          <h2>{selected.subject || "(No subject)"}</h2>
          <p className="mw-message-meta"><strong>{selected.author}</strong> → {selected.recipient} · Message #{selected.number} · {formatMysticDate(selected.dates.written)}</p>
          <pre><MysticText text={selected.body ?? "Message body not loaded."} /></pre>
        </article>}
      </section>
    </div>
  </div>;
}
