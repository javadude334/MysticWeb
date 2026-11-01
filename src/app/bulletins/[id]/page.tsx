import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { readMysticBulletin } from "@/lib/mystic/native-bulletins";
import { MysticText } from "@/components/mystic-text";

export default function BulletinPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Shell active="/features/bulletins"><section className="panel">Loading bulletin...</section></Shell>}><BulletinContent params={params} /></Suspense>;
}

async function BulletinContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9][0-9]?$/.test(id)) notFound();
  const bulletin = await readMysticBulletin(Number(id));
  if (!bulletin) notFound();
  return <Shell active="/features/bulletins"><section className="panel">
    <span className="eyebrow">MYSTIC BBS · SYSTEM BULLETIN {bulletin.id}</span>
    <h1>{bulletin.title}</h1>
    {bulletin.subject && <p style={{ fontFamily: "monospace", fontSize: "1rem", marginTop: "1rem" }}><MysticText text={bulletin.subject} /></p>}
    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", lineHeight: 1.7 }}><MysticText text={bulletin.body} /></pre>
    <p><Link href="/dashboard">Return to dashboard</Link></p>
  </section></Shell>;
}
