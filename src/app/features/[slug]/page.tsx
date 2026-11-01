import Link from "next/link";
import { Shell } from "@/components/shell";
import { defaultNavigation } from "@/lib/navigation/default-navigation";

export function generateStaticParams() {
  return defaultNavigation.filter(item => item.href.startsWith("/features/")).map(item => ({ slug: item.href.split("/").pop()! }));
}
export default async function FeaturePreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = defaultNavigation.find(entry => entry.href === "/features/" + slug);
  return <Shell active={item?.href ?? ""}><section className="panel">
    <span className="eyebrow">MYSTIC DEFAULT MENU · PLACEHOLDER</span>
    <h1>{item?.name ?? "Feature Preview"}</h1>
    <p>{item?.description ?? "This destination has not been configured."}</p>
    <p>This MysticWeb feature is a placeholder. No native BBS action is performed.</p>
    <Link href="/dashboard">Return to dashboard</Link>
  </section></Shell>;
}
