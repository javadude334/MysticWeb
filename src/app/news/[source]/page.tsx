import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { MysticText } from "@/components/mystic-text";
import { getSysopMenuItem } from "@/lib/scripting/sysop-menus";
import { readSysopMenuText } from "@/lib/mystic/sysop-text";

export default function NewsPage({ params }: { params: Promise<{ source: string }> }) {
  return <Suspense fallback={<section className="panel"><p>Loading news…</p></section>}><NewsPageContent params={params} /></Suspense>;
}

async function NewsPageContent({ params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  const item = await getSysopMenuItem("news", source);
  if (!item) notFound();
  const content = await readSysopMenuText("news", source);
  return <Shell active="/news">
    <div className="eyebrow">THE BOARD / NEWS</div>
    <div className="page-heading"><div><h1>{item.title}</h1><p>News text provided by the Mystic BBS updater.</p></div></div>
    <section className="panel">
      {content === null
        ? <p>This news page is not available. The Mystic updater may not have generated the text file yet.</p>
        : <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", lineHeight: 1.7 }}><MysticText text={content} /></pre>}
    </section>
    <p><Link href="/news">Back to News menu</Link></p>
  </Shell>;
}
