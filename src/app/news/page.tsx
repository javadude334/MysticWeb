import { Suspense } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { getSysopMenu } from "@/lib/scripting/sysop-menus";

export default function NewsMenuPage() {
  return <Suspense fallback={<section className="panel"><p>Loading news…</p></section>}><NewsMenuPageContent  /></Suspense>;
}

async function NewsMenuPageContent() {
  const menu = await getSysopMenu("news");
  return <Shell active="/news">
    <div className="eyebrow">THE BOARD / NEWS</div>
    <div className="page-heading"><div><h1>{menu?.title ?? "News"}</h1><p>{menu?.description ?? "News menu is not configured."}</p></div></div>
    <section className="panel" aria-label="News sources">
      {menu?.items.map(item => <p key={item.id}><Link href={`/news/${item.id}`}>{item.title}</Link></p>)}
    </section>
    <p><Link href="/dashboard">Return to dashboard</Link></p>
  </Shell>;
}
