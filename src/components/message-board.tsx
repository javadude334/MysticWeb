"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Area = { id: number; name: string };
type Message = { number: number; author: string; recipient: string; subject: string; dates: { written: number }; body?: string };
type Page = { area: Area; messages: Message[]; nextBefore: number | null };

export function MessageBoard() {
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [page, setPage] = useState<Page>();
  const [message, setMessage] = useState<Message>();
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("");
  const [failure, setFailure] = useState<number>();
  const pending = useRef<AbortController | null>(null);
  async function load(query = "") {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setStatus(""); setFailure(undefined);
    // Clear previously authorized content before any new access check.
    setMessage(undefined); setPage(undefined);
    try {
      const res = await fetch(`/api/messages${query}`, { cache: "no-store", signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setAreas([]); setFailure(res.status);
        setStatus(res.status === 401 ? "Sign in to read your message areas." : res.status === 503 ? "The secure Mystic connection is not available yet." : "This message area is unavailable or your access has changed.");
        return;
      }
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (data.areas) setAreas(data.areas);
      else { setPage(data); if (query.includes("message=")) setMessage(data.messages[0]); }
    } catch {
      if (!controller.signal.aborted) { setAreas([]); setStatus("Could not reach the board. Try again."); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  useEffect(() => {
    const controller = new AbortController(); pending.current = controller;
    fetch("/api/messages", { cache: "no-store", signal: controller.signal }).then(async res => {
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setFailure(res.status);
        setStatus(res.status === 401 ? "Sign in to read your message areas." : "The secure Mystic connection is not available yet.");
        return;
      }
      const data = await res.json();
      if (!controller.signal.aborted) setAreas(data.areas);
    }).catch(() => { if (!controller.signal.aborted) setStatus("Could not reach the board. Try again."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, []);
  async function logout() {
    pending.current?.abort(); setAreas([]); setPage(undefined); setMessage(undefined); setBusy(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      if (!res.ok) throw new Error();
      router.replace("/login"); router.refresh();
    } catch { setStatus("Sign-out could not be confirmed. Try again."); setBusy(false); }
  }
  return <div className="message-board" aria-busy={busy}>
    <div className="page-heading"><div><h1>Messages</h1><p>Browse your boards. Catch up with the conversation.</p></div><button className="button" disabled={busy} onClick={logout}>Sign out</button></div>
    <p role="status" aria-live="polite">{busy ? "Connecting to the board…" : status}</p>
    {failure === 401 && <Link className="button" href="/login">Sign in</Link>}
    {failure === 503 && <section className="panel"><h2>Waiting for a secure connection</h2><p>Native account verification must be connected before BBS messages can be displayed.</p></section>}
    {!busy && status && <button className="button" onClick={() => void load()}>Try again</button>}
    <div className="message-columns">
      <aside className="panel" aria-label="Message areas"><h2>Message areas</h2>
        {!busy && !status && areas.length === 0 && <p>No readable message areas are available for this account.</p>}
        {areas.map(area => <button className="area-button" aria-pressed={page?.area.id === area.id} disabled={busy} key={area.id} onClick={() => void load(`?area=${area.id}&limit=25`)}>{area.name}<span aria-hidden="true"> →</span></button>)}
      </aside>
      <section className="panel" aria-label="Message list">
        <h2>{page?.area.name ?? "Your conversations"}</h2>
        {!page && <p>Select a message area to read the board.</p>}
        {page && !message && <>
          {page.messages.length === 0 && <p>No messages on this page.</p>}
          <ul className="message-list">{page.messages.map(item => <li key={item.number}><button disabled={busy} onClick={() => void load(`?area=${page.area.id}&message=${item.number}`)}><strong>{item.subject || "(No subject)"}</strong><span>{item.author} → {item.recipient} · #{item.number}</span></button></li>)}</ul>
          <div className="message-actions"><button className="button" disabled={busy} onClick={() => void load(`?area=${page.area.id}&limit=25`)}>Newest</button>{page.nextBefore !== null && <button className="button" disabled={busy} onClick={() => void load(`?area=${page.area.id}&before=${page.nextBefore}&limit=25`)}>Older messages →</button>}</div>
        </>}
        {message && page && <article><button className="button" disabled={busy} onClick={() => void load(`?area=${page.area.id}&limit=25`)}>← Back to messages</button><h2>{message.subject || "(No subject)"}</h2><p>From {message.author} to {message.recipient} · #{message.number}</p><div className="message-body">{message.body ?? "Message text is unavailable."}</div></article>}
      </section>
    </div>
  </div>;
}
