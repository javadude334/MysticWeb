import type { Metadata } from "next";
import { Shell } from "@/components/shell";

export const metadata: Metadata = { title: "Private Mail" };

export default function Page() {
  return <Shell active="/private-mail">
    <div className="eyebrow">THE BOARD / PERSONAL MESSAGES</div>
    <div className="page-heading"><div><h1>Private Mail</h1><p>Personal correspondence stays separate from public echo areas.</p></div></div>
    <div className="mw-layout">
      <section className="mw-panel" aria-label="Mail folders">
        <h2>Mailboxes</h2>
        <p>Inbox</p><p>Sent</p><p>Drafts</p>
      </section>
      <section className="mw-panel mw-reader" aria-label="Private mail status">
        <h2>Private mail integration</h2>
        <p>Mail is not connected yet. No private messages are loaded or stored by MysticWeb.</p>
        <p>Native recipient verification, message ownership, private-mail storage format and write semantics must be established before inbox or compose actions can be enabled.</p>
        <p>Until then, use your BBS terminal session to read and send private mail.</p>
      </section>
    </div>
  </Shell>;
}
