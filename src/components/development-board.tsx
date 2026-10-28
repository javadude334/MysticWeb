"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Area = { id: number; name: string };
type Message = { number: number; author: string; subject: string; body?: string };
type Page = { area: Area; messages: Message[]; nextBefore: number | null };

export function DevelopmentBoard() {
  const [account, setAccount] = useState<string>();
  const [areas, setAreas] = useState<Area[]>([]);
  const [page, setPage] = useState<Page>();
  const [message, setMessage] = useState<Message>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  async function request(query = "", method = "GET") {
    const res = await fetch(`/api/development${query}`, { method, cache: "no-store" });
    if (!res.ok) throw new Error(res.status === 401 ? "Choose an account to start a new demo session." : "Access unavailable. Reload or choose another account.");
    return res.json();
  }
  async function refresh() {
    const data = await request(); setAccount(data.account.name); setAreas(data.areas);
  }
  useEffect(() => { let active = true; fetch("/api/development", { cache: "no-store" }).then(async res => { if (!res.ok) return; const data = await res.json(); if (active) { setAccount(data.account.name); setAreas(data.areas); } }).catch(() => {}).finally(() => { if (active) setBusy(false); }); return () => { active = false; }; }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="development-board" style={{ maxWidth: 960, margin: "auto", padding: "48px 24px" }}>
    <Link href="/">← Dave&apos;s BBS</Link>
    <p className="eyebrow">MYSTICWEB / DEVELOPMENT WORKSPACE</p>
    <h1>Read the board. Test the connection.</h1>
    <p>Synthetic data only. Native A48 authentication is not certified. Do not enter BBS credentials.</p>
    <section className="panel" aria-label="Demo session">
      <h2>{account ? `Signed in as ${account}` : "Choose a disposable account"}</h2>
      <p>Alice can read both boards. Bob can read the welcome board. Sessions expire after one hour or a server restart.</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[{ id: 42, name: "Alice" }, { id: 73, name: "Bob" }].map(a => <button key={a.id} disabled={busy} onClick={() => run(async () => {
          await request(`?account=${a.id}`, "POST"); setPage(undefined); setMessage(undefined); await refresh();
        })}>Enter as {a.name}</button>)}
        {account && <button disabled={busy} onClick={() => run(async () => {
          await request("", "DELETE"); setAccount(undefined); setAreas([]); setPage(undefined); setMessage(undefined);
        })}>Sign out</button>}
      </div>
    </section>
    <p role="status" aria-live="polite">{busy ? "Loading…" : error}</p>
    {account && <section className="panel"><h2>Message areas</h2><div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {areas.map(a => <button key={a.id} disabled={busy} onClick={() => run(async () => {
        setPage(await request(`?area=${a.id}`)); setMessage(undefined);
      })}>{a.name}</button>)}
    </div></section>}
    {page && <section className="panel"><h2>{page.area.name}</h2>
      <ul>{page.messages.map(m => <li key={m.number}><button disabled={busy} onClick={() => run(async () => {
        const data = await request(`?area=${page.area.id}&message=${m.number}`); setMessage(data.messages[0]);
      })}>{m.subject}</button> · {m.author}</li>)}</ul>
      {page.nextBefore && <button disabled={busy} onClick={() => run(async () => {
        setPage(await request(`?area=${page.area.id}&before=${page.nextBefore}`)); setMessage(undefined);
      })}>Older messages</button>}
      <button disabled={busy} onClick={() => run(async () => { setPage(await request(`?area=${page.area.id}`)); setMessage(undefined); })}>Newest messages</button>
    </section>}
    {message && <article className="panel"><h2>{message.subject}</h2><p>From {message.author}</p><p style={{ whiteSpace: "pre-wrap" }}>{message.body}</p></article>}
  </main>;
}
