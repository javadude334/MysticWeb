import Link from "next/link";
import { Shell } from "@/components/shell";
import { createNewsMenu } from "@/lib/scripting/news-menu";

export default function NewsMenuPage() {
  const menu = createNewsMenu();
  return <Shell active="/news">
    <div className="eyebrow">THE BOARD / NEWS</div>
    <div className="page-heading"><div><h1>{menu.title}</h1><p>Select a news source to read its locally generated Mystic news page.</p></div></div>
    <section className="panel" aria-label="News sources">
      {menu.items.map(item => <p key={item.id}><Link href={`/news/${item.id}`}>{item.title}</Link></p>)}
    </section>
    <p><Link href="/dashboard">Return to dashboard</Link></p>
  </Shell>;
}
