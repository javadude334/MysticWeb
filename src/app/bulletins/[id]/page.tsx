import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { readMysticBulletin } from "@/lib/mystic/native-bulletins";

export default async function BulletinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[12]$/.test(id)) notFound();
  const bulletin = await readMysticBulletin(Number(id));
  if (!bulletin) notFound();
  return <Shell active="/features/bulletins"><section className="panel">
    <span className="eyebrow">MYSTIC BBS · SYSTEM BULLETIN {bulletin.id}</span>
    <h1>{bulletin.title}</h1>
    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", lineHeight: 1.7 }}>{bulletin.body}</pre>
    <p><Link href="/dashboard">Return to dashboard</Link></p>
  </section></Shell>;
}
