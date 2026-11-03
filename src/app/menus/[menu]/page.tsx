import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSysopMenu, menuItemHref } from "@/lib/scripting/sysop-menus";

export default function SysopMenuPage({ params }: { params: Promise<{ menu: string }> }) {
  return <Suspense fallback={<section className="panel"><p>Loading menu…</p></section>}>
    <SysopMenuPageContent params={params} />
  </Suspense>;
}

async function SysopMenuPageContent({ params }: { params: Promise<{ menu: string }> }) {
  const { menu: id } = await params;
  const menu = await getSysopMenu(id);
  if (!menu) notFound();
  return <Shell active={id === "news" ? "/news" : ""}>
    <div className="eyebrow">THE BOARD / CUSTOM MENUS</div>
    <div className="page-heading"><div><h1>{menu.title}</h1><p>{menu.description}</p></div></div>
    <section className="panel" aria-label={menu.title}>
      {menu.items.map(item => <p key={item.id}><Link href={menuItemHref(menu.id, item)}>{item.title}</Link></p>)}
    </section>
    <p><Link href="/dashboard">Return to dashboard</Link></p>
  </Shell>;
}
