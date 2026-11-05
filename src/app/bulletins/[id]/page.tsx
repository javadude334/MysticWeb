import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { readMysticBulletin, readMysticBulletinMenu } from "@/lib/mystic/native-bulletins";
import { MysticText } from "@/components/mystic-text";

export default function BulletinPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Shell active="/features/bulletins"><section className="panel">Loading bulletin...</section></Shell>}><BulletinContent params={params} /></Suspense>;
}

async function BulletinContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9][0-9]?$/.test(id)) notFound();
  const [bulletin, entries] = await Promise.all([readMysticBulletin(Number(id)), readMysticBulletinMenu()]);
  if (!bulletin) notFound();
  return <Shell active="/features/bulletins"><section className="panel">\n    <nav aria-label="System bulletins" style={{ marginBottom: "1.5rem" }}>\n      <span className="eyebrow">MYSTIC BBS · SYSTEM BULLETINS</span>\n      <h2 style={{ marginTop: "0.5rem" }}>System Bulletins</h2>\n      {entries.map(entry => <p key={entry.id} style={{ margin: "0.35rem 0" }}>\n        <Link href={`/bulletins/${entry.id}`} aria-current={entry.id === bulletin.id ? "page" : undefined}\n          style={entry.id === bulletin.id ? { fontWeight: 700, textDecoration: "underline" } : undefined}>\n          {entry.id}. {entry.title}\n        </Link>\n      </p>)}\n    </nav>\n    <hr style={{ border: 0, borderTop: "1px solid var(--border, #304047)", margin: "1.5rem 0" }} />
    <span className="eyebrow">MYSTIC BBS · SYSTEM BULLETIN {bulletin.id}</span>
    <h1>{bulletin.title}</h1>
    {bulletin.subject && <p style={{ fontFamily: "monospace", fontSize: "1rem", marginTop: "1rem" }}><MysticText text={bulletin.subject} /></p>}
    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", lineHeight: 1.7 }}><MysticText text={bulletin.body} /></pre>
    <p><Link href="/features/bulletins">All system bulletins</Link> · <Link href="/dashboard">Return to dashboard</Link></p>
  </section></Shell>;
}
