import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { MysticText } from "@/components/mystic-text";
import { getSysopMenu, getSysopMenuItem, menuItemHref } from "@/lib/scripting/sysop-menus";
import { readSysopMenuText } from "@/lib/mystic/sysop-text";

export default async function SysopTextPage({ params }: { params: Promise<{ menu: string; item: string }> }) {
  const { menu: menuId, item: itemId } = await params;
  const [menu, item] = await Promise.all([getSysopMenu(menuId), getSysopMenuItem(menuId, itemId)]);
  if (!menu || !item) notFound();
  if (item.action !== "displayText") redirect(menuItemHref(menuId, item));
  const content = await readSysopMenuText(menuId, itemId);
  return <Shell active={menuId === "news" ? "/news" : ""}>
    <div className="eyebrow">THE BOARD / {menu.title.toUpperCase()}</div>
    <div className="page-heading"><div><h1>{item.title}</h1><p>{menu.description}</p></div></div>
    <section className="panel">
      {content === null
        ? <p>This text page is unavailable. Check that the configured Mystic text file exists.</p>
        : <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", lineHeight: 1.7 }}><MysticText text={content} /></pre>}
    </section>
    <p><Link href={`/menus/${menuId}`}>Back to {menu.title}</Link></p>
  </Shell>;
}
