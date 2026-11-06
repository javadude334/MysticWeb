"use client";
import { useCallback, useEffect, useState } from "react";

type Mail = { number: number; author: string; recipient: string; subject: string;
  body?: string; dates: { written: number }; replyTo: number };
type Recipient = { userId: number; handle: string; realName: string | null };
type Folder = "inbox" | "sent";
export function LocalMailWorkspace() {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [messages, setMessages] = useState<Mail[]>([]);
  const [selected, setSelected] = useState<Mail | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState(false);
  const [query, setQuery] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<number | undefined>();
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(async (which: Folder, page?: number) => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ folder: which });
      if (page) params.set("before", String(page));
      const response = await fetch("/api/mail?" + params, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Mailbox unavailable");
      setMessages(data.messages);
      setBefore(data.nextBefore);
    } catch (e) { setError(e instanceof Error ? e.message : "Mailbox unavailable"); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    const task = Promise.resolve().then(() => load(folder));
    void task;
  }, [folder, refresh, load]);
  useEffect(() => {
    if (!compose || recipient || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/messages?recipientLookup=" + encodeURIComponent(query),
          { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          setRecipients(Array.isArray(data.recipients) ? data.recipients : []);
        }
      } catch { /* A new keystroke cancels the previous search. */ }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, recipient, compose]);
  async function openMessage(mail: Mail) {
    setError("");
    try {
      const response = await fetch("/api/mail?folder=" + folder + "&message=" + mail.number,
        { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.messages?.length !== 1) throw new Error(data.error ?? "Mail unavailable");
      setSelected(data.messages[0]);
    } catch (e) { setError(e instanceof Error ? e.message : "Mail unavailable"); }
  }
  function newMessage(mail?: Mail) {
    setCompose(true); setSelected(null); setError("");
    setRecipient(null); setRecipients([]);
    setQuery(mail?.author ?? "");
    setSubject(mail ? (/^Re:/i.test(mail.subject) ? mail.subject : "Re: " + mail.subject) : "");
    setBody(""); setReplyTo(mail?.number);
  }
  async function send() {
    if (!recipient || !subject.trim() || !body.trim()) {
      setError("Select an existing Mystic user and enter a subject and message."); return;
    }
    setBusy(true); setError("");
    try {
      const payload = { recipientId: recipient.userId, subject, body,
        ...(replyTo === undefined ? {} : { replyTo }) };
      const raw = JSON.stringify(payload);
      const response = await fetch("/api/mail", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: raw,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send mail");
      setCompose(false); setFolder("sent"); setRefresh(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send mail"); }
    finally { setBusy(false); }
  }
  return <section className="card" style={{ padding: "1rem" }}>
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      <button type="button" onClick={() => { setCompose(false); setSelected(null); setFolder("inbox"); }}>Inbox</button>
      <button type="button" onClick={() => { setCompose(false); setSelected(null); setFolder("sent"); }}>Sent</button>
      <button type="button" onClick={() => newMessage()}>Compose</button>
      <button type="button" onClick={() => { setSelected(null); setRefresh(v => v + 1); }}>Refresh</button>
    </div>
    {error && <p role="alert" style={{ color: "var(--danger, #d66)" }}>{error}</p>}
    {compose ? <div style={{ display: "grid", gap: "0.75rem" }}>
      <label>To (existing Mystic user)
        <input value={query} onChange={e => { setQuery(e.target.value); setRecipient(null); setReplyTo(undefined); }}
          placeholder="Start typing a name or handle" autoComplete="off" />
      </label>
      {recipient && <p>Selected: {recipient.handle} (user #{recipient.userId})</p>}
      {!recipient && recipients.length > 0 && <div role="listbox" aria-label="Matching Mystic users">
        {recipients.map(user => <button type="button" key={user.userId} role="option"
          aria-selected={false} onClick={() => { setRecipient(user); setQuery(user.handle); setRecipients([]); }}>
          {user.handle}{user.realName ? " — " + user.realName : ""}
        </button>)}
      </div>}
      <label>Subject <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={255} /></label>
      <label style={{ display: "grid", gap: "0.4rem", width: "100%" }}>Message
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={18} maxLength={60000}
          style={{ display: "block", width: "100%", minHeight: "360px", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      </label>
      <div style={{ display: "flex", gap: "0.9rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <button type="button" disabled={busy || !recipient} onClick={() => void send()}
          style={{ background: "#20513d", border: "1px solid #37654f", borderRadius: "9px", color: "#fff", padding: "0.9rem 1.5rem", fontSize: "1rem", fontWeight: 700, minHeight: "48px", cursor: busy || !recipient ? "not-allowed" : "pointer", opacity: busy || !recipient ? 0.55 : 1 }}>
          {busy ? "Sending…" : "Send Local Mail"}
        </button>
        <button type="button" disabled={busy} onClick={() => setCompose(false)}
          style={{ background: "#24333c", border: "1px solid #4b5c66", borderRadius: "9px", color: "#fff", padding: "0.9rem 1.5rem", fontSize: "1rem", fontWeight: 600, minHeight: "48px", cursor: busy ? "not-allowed" : "pointer" }}>
          Cancel
        </button>
      </div>
    </div> : selected ? <article>
      <button type="button" onClick={() => setSelected(null)}>Back to {folder}</button>
      <h2>{selected.subject}</h2>
      <p>From: {selected.author} | To: {selected.recipient}</p>
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" }}>{selected.body}</pre>
      {folder === "inbox" && <button type="button" onClick={() => newMessage(selected)}>Reply</button>}
    </article> : <>
      <h2>{folder === "inbox" ? "Inbox" : "Sent Mail"}</h2>
      {busy && <p>Loading mail…</p>}
      {!busy && messages.length === 0 && <p>No messages in this page.</p>}
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {messages.map(m => <button type="button" key={m.number}
          onClick={() => void openMessage(m)} style={{ textAlign: "left", padding: "0.6rem" }}>
          <strong>{m.subject || "(no subject)"}</strong> — {folder === "inbox" ? m.author : m.recipient}
          <small style={{ marginLeft: "0.75rem" }}>#{m.number}</small>
        </button>)}
      </div>
      {before !== null && <button type="button" disabled={busy} onClick={() => void load(folder, before)}>Older mail</button>}
    </>}
  </section>;
}
