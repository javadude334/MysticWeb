import { Suspense } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { MysticText } from "@/components/mystic-text";
import { defaultNavigation } from "@/lib/navigation/default-navigation";
import { getSysopMenu, menuItemHref } from "@/lib/scripting/sysop-menus";
import { readSysopMenuText } from "@/lib/mystic/sysop-text";
import { readMysticBulletinMenu } from "@/lib/mystic/native-bulletins";

export function generateStaticParams() {
  return defaultNavigation.filter(item => item.href.startsWith("/features/")).map(item => ({ slug: item.href.split("/").pop()! }));
}
export default function FeaturePreview({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<section className="panel"><p>Loading feature…</p></section>}>
    <FeaturePreviewContent params={params} />
  </Suspense>;
}

async function FeaturePreviewContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = defaultNavigation.find(entry => entry.href === "/features/" + slug);
  if (slug === "bulletins") {
    const entries = await readMysticBulletinMenu();
    return <Shell active="/features/bulletins"><section className="panel">
      <span className="eyebrow">MYSTIC BBS · SYSTEM BULLETINS</span>
      <h1>System Bulletins</h1>
      {entries.length ? entries.map(entry => <p key={entry.id}><Link href={`/bulletins/${entry.id}`}>{entry.id}. {entry.title}</Link></p>)
        : <p>No bulletin entries are available from the configured Mystic bulletin menu.</p>}
      <Link href="/dashboard">Return to dashboard</Link>
    </section></Shell>;
  }
  if (slug === "demos" || slug === "goodbye") {
    const menu = await getSysopMenu(slug);
    if (menu) {
      const farewell = slug === "goodbye" ? menu.items.find(entry => entry.action === "displayText") : undefined;
      const text = farewell ? await readSysopMenuText(slug, farewell.id) : null;
      return <Shell active={item?.href ?? ""}><section className="panel">
        <span className="eyebrow">MYSTICWEB · SYSOP MENU</span>
        <h1>{menu.title}</h1><p>{menu.description}</p>
        {slug === "goodbye" && (text === null ? <p>Goodbye text file is not available in the configured Mystic theme.</p>
          : <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" }}><MysticText text={text} /></pre>)}
        {menu.items.filter(entry => slug !== "goodbye" || entry.action !== "displayText").map(entry =>
          <p key={entry.id}><Link href={menuItemHref(menu.id, entry)}>{entry.title}</Link></p>)}
        <Link href="/dashboard">Return to dashboard</Link>
      </section></Shell>;
    }
  }
  return <Shell active={item?.href ?? ""}><section className="panel">
    <span className="eyebrow">MYSTIC DEFAULT MENU · PLACEHOLDER</span>
    <h1>{item?.name ?? "Feature Preview"}</h1>
    <p>{item?.description ?? "This destination has not been configured."}</p>
    <p>This MysticWeb feature is a placeholder. No native BBS action is performed.</p>
    {item?.command && <p>Reserved scripting command: <code>{item.command}()</code> — awaiting an authorized Mystic provider.</p>}
    <Link href="/dashboard">Return to dashboard</Link>
  </section></Shell>;
}
