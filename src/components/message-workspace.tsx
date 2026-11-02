"use client";

import { useCallback, useEffect, useState } from "react";

type Area = { id: number; name: string };
type Message = { number: number; author: string; recipient: string; subject: string; body?: string; dates: { written: number } };
type Page = { area: Area; messages: Message[]; nextBefore: number | null };

function validArea(value: unknown): value is Area {
  return !!value && typeof value === "object" && Number.isSafeInteger((value as Area).id) &&
    (value as Area).id > 0 && typeof (value as Area).name === "string";
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
  const [area, setArea] = useState<Area | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setAreas([]);
    getJSON("/api/messages", controller.signal).then(value => {
      if (!value || typeof value !== "object" || !("areas" in value) || !Array.isArray(value.areas) || value.areas.length > 512 || !value.areas.every(validArea)) throw new Error("Invalid area catalog.");
      setAreas(value.areas);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Messages unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const load = useCallback((chosen: Area, before?: number) => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ area: String(chosen.id), limit: "25" });
    if (before !== undefined) params.set("before", String(before));
    getJSON("/api/messages?" + params.toString(), controller.signal).then(value => {
      if (!validPage(value) || value.area.id !== chosen.id) throw new Error("Invalid message response.");
      setPage(value); setSelected(null);
    }).catch(e => { setPage(null); setSelected(null); setError(e instanceof Error ? e.message : "Messages unavailable."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!area) return;
    return load(area);
  }, [area, load]);
  return <div className="mw-layout">
    <aside className="mw-panel" aria-label="Message areas">
      <div className="mw-heading"><h2>Message areas</h2><button type="button" onClick={() => { setArea(null); setPage(null); setRefresh(v => v + 1); }}>Refresh</button></div>
      {areas.length === 0 && !loading && !error && <p>No accessible message areas.</p>}
      <div className="mw-area-list">{areas.map(item =>
        <button type="button" key={item.id} aria-current={area?.id === item.id ? "true" : undefined}
          className={area?.id === item.id ? "mw-active" : ""} onClick={() => { setPage(null); setSelected(null); setArea(item); }}>
          {item.name}
        </button>)}</div>
    </aside>
    <section className="mw-panel mw-reader" aria-label="Message reader" aria-live="polite">
      {loading && <p role="status">Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {!area && !loading && <p>Select an authorized message area to read its conversations.</p>}
      {area && <h2>{area.name}</h2>}
      {page && <><div className="mw-thread-list">{page.messages.map(message =>
        <button type="button" key={message.number} className={selected?.number === message.number ? "mw-active" : ""}
          onClick={() => setSelected(message)}>
          <strong>{message.subject || "(No subject)"}</strong><span>{message.author} · #{message.number}</span>
        </button>)}</div>
        {page.messages.length === 0 && <p>No readable messages in this page.</p>}
        {page.nextBefore !== null && <button type="button" disabled={loading} onClick={() => load(area!, page.nextBefore!)}>Older messages</button>}
      </>}
      {selected && <article className="mw-message"><h3>{selected.subject || "(No subject)"}</h3>
        <p>From: {selected.author} · To: {selected.recipient} · #{selected.number}</p>
        {selected.body === undefined ? <p>Message body not loaded.</p> : <pre>{selected.body}</pre>}
      </article>}
    </section>
  </div>;
}
