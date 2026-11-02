"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "./messages.module.css";

type Kind = "local" | "netmail";
type Folder = "Inbox" | "Sent" | "Drafts";

export default function Page() {
  const [folder, setFolder] = useState<Folder>("Inbox");
  const [compose, setCompose] = useState(false);
  const [kind, setKind] = useState<Kind>("local");
  const [recipient, setRecipient] = useState("");
  const [address, setAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><Link href="/">← Dave&apos;s BBS</Link><h1>Private Messages</h1><p>Local private messages and FTN NetMail</p></div>
      <button type="button" onClick={() => setCompose(true)}>Compose</button>
    </header>
    <p className={styles.notice} role="status">Preview only: native authentication and private-message access are not enabled. No messages are read or sent.</p>
    <div className={styles.layout}>
      <nav className={styles.folders} aria-label="Mail folders">
        {(["Inbox","Sent","Drafts"] as Folder[]).map(name =>
          <button key={name} type="button" aria-current={folder === name ? "page" : undefined}
            onClick={() => {setFolder(name);setCompose(false);}}>{name}</button>)}
      </nav>
      <section className={styles.panel}>
        {compose ? <form onSubmit={event => event.preventDefault()}>
          <h2>Compose message</h2>
          <fieldset><legend>Message type</legend>
            <label><input type="radio" name="kind" checked={kind === "local"} onChange={() => setKind("local")} /> Local private message</label>
            <label><input type="radio" name="kind" checked={kind === "netmail"} onChange={() => setKind("netmail")} /> FTN NetMail</label>
          </fieldset>
          <label className={styles.field}>{kind === "local" ? "Mystic user alias" : "Recipient name"}
            <input value={recipient} onChange={event => setRecipient(event.target.value)} autoComplete="off" />
          </label>
          {kind === "netmail" && <label className={styles.field}>Destination FTN address
            <input value={address} onChange={event => setAddress(event.target.value)} placeholder="zone:net/node.point" autoComplete="off" />
            <small>Network, originating identity and message base will come from Mystic configuration.</small>
          </label>}
          <label className={styles.field}>Subject<input value={subject} onChange={event => setSubject(event.target.value)} /></label>
          <label className={styles.field}>Message<textarea rows={12} value={body} onChange={event => setBody(event.target.value)} /></label>
          <p>Sending and saving drafts require verified native identity and message-base permissions.</p>
          <button type="button" disabled>Send (not available)</button>{" "}
          <button type="button" onClick={() => setCompose(false)}>Close</button>
        </form> : <div><h2>{folder}</h2><p>Messages will appear here when the authenticated Mystic message service is connected.</p>
          <button type="button" onClick={() => setCompose(true)}>Compose a message</button></div>}
      </section>
    </div>
  </main>;
}
