"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { defaultNavigation } from "@/lib/navigation/default-navigation";
import styles from "./sidebar-navigation.module.css";
import { collectionIds, navigationCollections, type CollectionNode } from "@/lib/navigation/navigation-collections";

const storageKey = "mysticweb:sidebar:v3";
type Saved = { collapsed: boolean; open: string[] };
function load(): Saved | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!value || typeof value.collapsed !== "boolean" || !Array.isArray(value.open) ||
      !value.open.every((id: unknown) => typeof id === "string" && (id === "main-menu" || collectionIds().includes(id)))) return null;
    return { collapsed: value.collapsed, open: value.open };
  } catch { return null; }
}
export function SidebarNavigation({ active }: { active: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
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
  const renderNode = (node: CollectionNode, depth: number): React.ReactNode => {
    if (node.type === "link") {
      const item = items.find(entry => entry.href === node.href);
      if (!item) return null;
      return <Link key={node.href} href={item.href} aria-current={selected(item.href) ? "page" : undefined}
        className={`${styles.link} ${selected(item.href) ? styles.active : ""}`}
        title={item.name} onClick={() => setMobileOpen(false)}>
        <span className={styles.symbol} aria-hidden="true">{item.icon}</span>
        <span className={styles.linkText}>{item.name}</span>
      </Link>;
    }
    const expanded = open.includes(node.id);
    return <div key={node.id} className={styles.group}>
      <button type="button" className={styles.groupButton} title={node.title}
        aria-expanded={expanded && !collapsed} aria-controls={`nav-group-${node.id}`}
        onClick={() => {
          if (collapsed) {
            setCollapsed(false);
            setOpen(previous => previous.includes(node.id) ? previous : [...previous, node.id]);
          } else setOpen(previous => previous.includes(node.id)
            ? previous.filter(id => id !== node.id) : [...previous, node.id]);
        }}>
        <span aria-hidden="true" className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
        <span aria-hidden="true" className={styles.symbol}>{node.icon}</span>
        <span className={styles.groupText}>{node.title}</span>
      </button>
      <div id={`nav-group-${node.id}`} className={styles.children}
        hidden={!expanded || collapsed} data-depth={depth + 1}>
        {node.children.map(child => renderNode(child, depth + 1))}
      </div>
    </div>;
  };
  return <div className={`${styles.layout} ${collapsed ? styles.collapsed : ""}`}>
    <aside className={styles.sidebar} aria-label="BBS navigation">
      <div className={styles.heading}>
        <Link href="/dashboard" className={styles.brand} aria-label="MysticWeb dashboard"><span className={styles.mark}>M</span><span className={styles.brandText}>Mystic<span>Web</span><small>A NEW WAY TO BBS</small></span></Link>
        <button type="button" className={styles.toggle} onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>{collapsed ? "»" : "«"}</button>
        <button type="button" className={styles.mobileToggle} onClick={() => setMobileOpen(v => !v)} aria-expanded={mobileOpen} aria-controls="mysticweb-sidebar-folders">{mobileOpen ? "Close menu" : "Menu ☰"}</button>
      </div>
      <nav id="mysticweb-sidebar-folders" aria-label="Main navigation" className={`${styles.navigation} ${mobileOpen ? styles.mobileOpen : ""}`}>
        <Link href="/dashboard" title="Dashboard" aria-current={selected("/dashboard") ? "page" : undefined} className={`${styles.link} ${selected("/dashboard") ? styles.active : ""}`}><span aria-hidden="true" className={styles.symbol}>▦</span><span className={styles.linkText}>Dashboard</span></Link>
        <div className={styles.group}>
          <div className={styles.menuHeading}>
            <button type="button" className={styles.menuChevron}
              aria-label={open.includes("main-menu") ? "Collapse Main Menu" : "Expand Main Menu"}
              aria-expanded={!collapsed && open.includes("main-menu")} aria-controls="nav-group-main-menu"
              onClick={() => {
                if (collapsed) setCollapsed(false);
                setOpen(previous => previous.includes("main-menu")
                  ? previous.filter(id => id !== "main-menu") : [...previous, "main-menu"]);
              }}>
              {open.includes("main-menu") ? "▾" : "▸"}
            </button>
            <Link href="/main-menu" title="Open Main Menu"
              aria-current={selected("/main-menu") ? "page" : undefined}
              className={`${styles.link} ${selected("/main-menu") ? styles.active : ""}`}
              onClick={() => setMobileOpen(false)}>
              <span aria-hidden="true" className={styles.symbol}>☷</span>
              <span className={styles.linkText}>Main Menu</span>
            </Link>
          </div>
          <div id="nav-group-main-menu" className={styles.children}
            hidden={!open.includes("main-menu") || collapsed}>
            {items.filter(item => item.href !== "/dashboard" && item.href !== "/main-menu")
              .map(item => renderNode({ type: "link", href: item.href }, 1))}
          </div>
        </div>
        {navigationCollections.map(node => renderNode(node, 0))}
      </nav>
    </aside>
  </div>;
}
