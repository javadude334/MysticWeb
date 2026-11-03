"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultNavigation } from "@/lib/navigation/default-navigation";
import styles from "./sidebar-navigation.module.css";

const groups = [
  { id: "messages", title: "Messages", icon: "✉", paths: ["/messages", "/private-mail"] },
  { id: "files", title: "Files & Doors", icon: "▣", paths: ["/files", "/door-games"] },
  { id: "community", title: "Community", icon: "♧", paths: ["/relay-chat", "/features/whos-online", "/features/last-callers", "/features/one-liners", "/features/voting", "/features/users", "/features/node-message", "/features/page-user", "/features/bbs-list"] },
  { id: "board", title: "Board & SysOp", icon: "◇", paths: ["/news", "/features/bulletins", "/features/contact-sysop", "/features/page-sysop", "/features/time-bank", "/features/usage", "/features/demos", "/features/goodbye"] },
  { id: "account", title: "Account", icon: "◎", paths: ["/my-profile"] },
] as const;
const storageKey = "mysticweb:sidebar:v1";
type Saved = { collapsed: boolean; open: string[] };
function load(): Saved | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!value || typeof value.collapsed !== "boolean" || !Array.isArray(value.open) ||
      !value.open.every((id: unknown) => typeof id === "string" && groups.some(g => g.id === id))) return null;
    return { collapsed: value.collapsed, open: value.open };
  } catch { return null; }
}
export function SidebarNavigation({ active }: { active: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<string[]>(groups.map(g => g.id));
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const saved = load();
    if (saved) { setCollapsed(saved.collapsed); setOpen(saved.open); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ collapsed, open })); } catch { /* storage optional */ }
  }, [ready, collapsed, open]);
  const items = defaultNavigation.filter(item => item.enabled !== false);
  const selected = (href: string) => active === href || (href !== "/" && active.startsWith(href + "/"));
  return <div className={`${styles.layout} ${collapsed ? styles.collapsed : ""}`}>
    <aside className={styles.sidebar} aria-label="BBS navigation">
      <div className={styles.heading}>
        <Link href="/dashboard" className={styles.brand} aria-label="MysticWeb dashboard"><span className={styles.mark}>M</span><span className={styles.brandText}>Mystic<span>Web</span><small>A NEW WAY TO BBS</small></span></Link>
        <button type="button" className={styles.toggle} onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>{collapsed ? "»" : "«"}</button>
        <button type="button" className={styles.mobileToggle} onClick={() => setMobileOpen(v => !v)} aria-expanded={mobileOpen} aria-controls="mysticweb-sidebar-folders">{mobileOpen ? "Close menu" : "Menu ☰"}</button>
      </div>
      <nav id="mysticweb-sidebar-folders" aria-label="Main navigation" className={`${styles.navigation} ${mobileOpen ? styles.mobileOpen : ""}`}>
        <Link href="/dashboard" title="Dashboard" aria-current={selected("/dashboard") ? "page" : undefined} className={`${styles.link} ${selected("/dashboard") ? styles.active : ""}`}><span aria-hidden="true" className={styles.symbol}>▦</span><span className={styles.linkText}>Dashboard</span></Link>
        {groups.map(group => {
          const entries = items.filter(item => (group.paths as readonly string[]).includes(item.href));
          if (!entries.length) return null;
          const expanded = open.includes(group.id);
          return <div key={group.id} className={styles.group}>
            <button type="button" className={styles.groupButton} title={group.title} aria-expanded={expanded} aria-controls={`nav-group-${group.id}`} onClick={() => { if (collapsed) setCollapsed(false); setOpen(previous => previous.includes(group.id) ? previous : [...previous, group.id]); } else setOpen(previous => previous.includes(group.id) ? previous.filter(id => id !== group.id) : [...previous, group.id]); }}>
              <span aria-hidden="true" className={styles.chevron}>{expanded ? "▾" : "▸"}</span><span aria-hidden="true" className={styles.symbol}>{group.icon}</span><span className={styles.groupText}>{group.title}</span>
            </button>
            <div id={`nav-group-${group.id}`} className={styles.children} hidden={!expanded || collapsed}>
              {entries.map(item => <Link key={item.href} href={item.href} aria-current={selected(item.href) ? "page" : undefined} className={`${styles.link} ${selected(item.href) ? styles.active : ""}`} title={item.name}><span className={styles.symbol} aria-hidden="true">{item.icon}</span><span>{item.name}</span></Link>)}
            </div>
          </div>;
        })}
      </nav>
    </aside>
  </div>;
}
