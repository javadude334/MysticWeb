"use client";
import { useCallback, useEffect, useState } from "react";
import { MessageAction, MessageActions, MessageBody, MessageDetails, MessageField, messageInputStyle } from "./message-ui";

type Mail = { number: number; author: string; recipient: string; subject: string;
  body?: string; dates: { written: number }; replyTo: number; attributes: number };
type Recipient = { userId: number; handle: string; realName: string | null };
type Folder = "inbox" | "sent";
type MailService = "local" | "netmail" | "internet";
export function LocalMailWorkspace() {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [services, setServices] = useState<Record<MailService, boolean>>({ local: true, netmail: true, internet: true });
  const [hideRead, setHideRead] = useState(false);
  const [composeService, setComposeService] = useState<MailService>("local");
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
    if (!compose || replyTo !== undefined || recipient || query.trim().length < 2) return;
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
  }, [query, recipient, compose, replyTo]);
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
  function newMessage() {
    setCompose(true); setSelected(null); setError("");
    setRecipient(null); setRecipients([]); setQuery("");
    setSubject(""); setBody(""); setReplyTo(undefined); setComposeService("local");
  }
  async function replyMessage(mail: Mail) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/mail?folder=inbox&message=" + mail.number + "&replyRecipient=1",
        { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.recipient) throw new Error(data.error ?? "Unable to resolve original sender");
      const resolved = data.recipient as Recipient;
      setRecipient(resolved); setRecipients([]); setQuery(resolved.handle);
      setSubject(/^Re:/i.test(mail.subject) ? mail.subject : "Re: " + mail.subject);
      setBody(""); setReplyTo(mail.number); setComposeService("local");
      setSelected(null); setCompose(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to reply"); }
    finally { setBusy(false); }
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
      setCompose(false); setSelected(null); setFolder("inbox"); setRefresh(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send mail"); }
    finally { setBusy(false); }
  }
  return <section className="card" style={{ padding: "1rem" }}>
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      <MessageAction onClick={() => { setCompose(false); setSelected(null); setFolder("inbox"); }}>Inbox</MessageAction>
      <MessageAction onClick={() => { setCompose(false); setSelected(null); setFolder("sent"); }}>Sent</MessageAction>
      <MessageAction primary onClick={() => newMessage()}>Compose</MessageAction>
      <MessageAction onClick={() => { setSelected(null); setRefresh(v => v + 1); }}>Refresh</MessageAction>
    </div>
    <fieldset style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem",
      padding: "0 0 0.75rem", margin: "0 0 0.75rem", border: 0, borderBottom: "1px solid #364b55" }}>
      <legend style={{ color: "#a9c3cc", fontSize: "0.85rem", marginBottom: "0.35rem" }}>Show mail types</legend>
      {([
        { id: "local", label: "Local Mail" },
        { id: "netmail", label: "NetMail (planned)" },
        { id: "internet", label: "eMail (planned)" },
      ] as const).map(item => <label key={item.id} style={{ display: "inline-flex", alignItems: "center",
        gap: "0.4rem", cursor: "pointer", whiteSpace: "nowrap", fontSize: "0.9rem" }}>
        <input type="checkbox" checked={services[item.id]}
          onChange={e => setServices(current => ({ ...current, [item.id]: e.target.checked }))} />
        {item.label}
      </label>)}
    </fieldset>
    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem", marginBottom: "1rem", cursor: "pointer" }}>
      <input type="checkbox" checked={hideRead} onChange={e => setHideRead(e.target.checked)} />
      Hide read messages
    </label>
    {error && <p role="alert" style={{ color: "var(--danger, #d66)" }}>{error}</p>}
    {compose ? <div style={{ display: "grid", gap: "0.75rem" }}>
      <MessageField label="Send via"><select style={messageInputStyle} value={composeService} disabled={replyTo !== undefined}
        onChange={e => setComposeService(e.target.value as MailService)}>
        <option value="local">Local Mail</option><option value="netmail" disabled>NetMail (planned)</option>
        <option value="internet" disabled>Internet Email (planned)</option>
      </select></MessageField>
      <MessageField label={replyTo !== undefined ? "To (original sender)" : "To (existing Mystic user)"}>
        <input style={{ ...messageInputStyle, ...(replyTo !== undefined ? { opacity: 0.85, cursor: "default" } : {}) }} value={query}
          readOnly={replyTo !== undefined}
          onChange={e => { if (replyTo === undefined) { setQuery(e.target.value); setRecipient(null); } }}
          placeholder="Start typing a name or handle" autoComplete="off" />
      </MessageField>
      {recipient && replyTo === undefined && <p style={{ margin: 0, color: "#a9c3cc" }}>Selected: {recipient.handle}</p>}
      {replyTo === undefined && !recipient && recipients.length > 0 && <div role="listbox" aria-label="Matching Mystic users">
        {recipients.map(user => <button type="button" key={user.userId} role="option"
          aria-selected={false} onClick={() => { setRecipient(user); setQuery(user.handle); setRecipients([]); }}>
          {user.handle}{user.realName ? " — " + user.realName : ""}
        </button>)}
      </div>}
      <MessageField label="Subject"><input style={messageInputStyle} value={subject} onChange={e => setSubject(e.target.value)} maxLength={255} /></MessageField>
      <MessageField label="Message">
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={18} maxLength={60000}
          style={{ ...messageInputStyle, minHeight: "360px", resize: "vertical", lineHeight: 1.5 }} />
      </MessageField>
      <MessageActions>
        <MessageAction primary disabled={busy || !recipient} onClick={() => void send()}>
          {busy ? "Sending…" : "Send Local Mail"}
        </MessageAction>
        <MessageAction disabled={busy} onClick={() => setCompose(false)}>Cancel</MessageAction>
      </MessageActions>
    </div> : selected ? <article style={{ display: "grid", gap: "0.75rem", width: "100%" }}>
      <h2 style={{ margin: 0, fontSize: "1.6rem", overflowWrap: "anywhere" }}>{selected.subject || "(no subject)"}</h2>
      <MessageDetails from={selected.author} to={selected.recipient}
        date={selected.dates?.written ? new Date(selected.dates.written * 1000).toLocaleString() : undefined} />
      <MessageBody>{selected.body || "(empty message)"}</MessageBody>
      <MessageActions>
        {folder === "inbox" && <MessageAction primary disabled={busy} onClick={() => void replyMessage(selected)}>Reply</MessageAction>}
        <MessageAction onClick={() => setSelected(null)}>Back to {folder === "inbox" ? "Inbox" : "Sent Mail"}</MessageAction>
      </MessageActions>
    </article> : <>
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.5rem" }}>{folder === "inbox" ? "Inbox" : "Sent Mail"}</h2>
      {busy && <p>Loading mail…</p>}
      {!busy && services.local && messages.length === 0 && <p>No messages in this folder.</p>}
      {!services.local && <p style={{ color: "#a9c3cc" }}>Local Mail is hidden by your filter.</p>}
      {!busy && services.local && messages.length > 0 && hideRead && folder === "inbox" && !messages.some(m => (m.attributes & 0x00000008) === 0) && <p>No unread messages on this page.</p>}
      <div style={{ overflowX: "auto", border: "1px solid #364b55", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "620px", textAlign: "left" }}>
          <thead style={{ background: "#1b2a30", color: "#a9c3cc" }}>
            <tr>
              <th scope="col" style={{ padding: "0.85rem 0.9rem", width: "5rem" }}>#</th>
              <th scope="col" style={{ padding: "0.85rem 0.9rem", width: "6rem" }}>Type</th>
              <th scope="col" style={{ padding: "0.85rem 0.9rem", width: "22%" }}>{folder === "inbox" ? "From" : "To"}</th>
              <th scope="col" style={{ padding: "0.85rem 0.9rem" }}>Subject</th>
              <th scope="col" style={{ padding: "0.85rem 0.9rem", width: "11rem" }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {messages.filter(m => services.local && (!hideRead || folder !== "inbox" || (m.attributes & 0x00000008) === 0)).map(m => {
              const unread = folder === "inbox" && (m.attributes & 0x00000008) === 0;
              return <tr key={m.number} style={{ borderTop: "1px solid #364b55", background: unread ? "#182d2d" : "#121c21" }}>
                <td style={{ padding: "0.75rem 0.9rem", whiteSpace: "nowrap" }}>
                  {unread && <span title="Unread in native Mystic" aria-label="Unread" style={{ color: "#7bd9b3", marginRight: "0.4rem" }}>●</span>}
                  {m.number}
                </td>
                <td style={{ padding: "0.75rem 0.9rem", color: "#a9c3cc" }}>Local</td>
                <td style={{ padding: "0.75rem 0.9rem", overflowWrap: "anywhere" }}>{folder === "inbox" ? m.author : m.recipient}</td>
                <td style={{ padding: "0.75rem 0.9rem" }}>
                  <button type="button" onClick={() => void openMessage(m)}
                    style={{ background: "none", border: 0, padding: 0, color: "#b7e9d6",
                      font: "inherit", fontWeight: unread ? 700 : 500, cursor: "pointer", textAlign: "left", overflowWrap: "anywhere" }}>
                    {m.subject || "(no subject)"}
                  </button>
                </td>
                <td style={{ padding: "0.75rem 0.9rem", whiteSpace: "nowrap", color: "#a9c3cc" }}>
                  {m.dates?.written ? new Date(m.dates.written * 1000).toLocaleDateString() : "—"}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
      {folder === "inbox" && services.local && messages.some(m => (m.attributes & 0x00000008) === 0) &&
        <p style={{ color: "#a9c3cc", fontSize: "0.85rem", margin: "0.5rem 0 0" }}>● Unread according to the JAM message flag. Opening mail here does not change Mystic's read status.</p>}
      {before !== null && services.local && <MessageActions><MessageAction disabled={busy} onClick={() => void load(folder, before)}>Older mail</MessageAction></MessageActions>}
    </>}
  </section>;
}
