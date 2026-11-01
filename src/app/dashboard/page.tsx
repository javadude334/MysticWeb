import Link from "next/link";
import { Shell } from "@/components/shell";
import styles from "./mystic-theme.module.css";

// Mystic default-theme menu names inform the sections below. Routes are
// MysticWeb preview destinations, not executable Mystic menu commands.
const destinations = [
  { name: "Message Menu", icon: "✉", href: "/messages", description: "Browse message groups and conversations." },
  { name: "File Areas", icon: "↓", href: "/files", description: "Explore the BBS file libraries." },
  { name: "Door Games", icon: "◇", href: "/door-games", description: "Find games and external doors." },
  { name: "Account Settings", icon: "◎", href: "/my-profile", description: "Manage your BBS identity and preferences." },
  { name: "Private Mail", icon: "✉", href: "/private-mail", description: "Your personal BBS mailbox." },
  { name: "Relay Chat", icon: "#", href: "/relay-chat", description: "Chat with other callers." },
] as const;

export default function Dashboard() {
  return <Shell active="/dashboard">
    <header className={styles.hero}>
      <span className={styles.eyebrow}>MysticWeb · Default Theme</span>
      <h1>Welcome to the BBS</h1>
      <p>A modern home for the message boards, file areas, bulletins, and community features of Mystic BBS.</p>
      <div className={styles.heroActions}>
        <Link href="/messages">Explore message boards</Link>
        <Link href="/files">Browse files</Link>
      </div>
    </header>

    <section className={styles.stats} aria-label="Board status">
      <div className={styles.stat}><span>New messages</span><strong>—</strong><span>Awaiting native connection</span></div>
      <div className={styles.stat}><span>Private mail</span><strong>—</strong><span>Not checked in preview</span></div>
      <div className={styles.stat}><span>Callers today</span><strong>—</strong><span>Awaiting native statistics</span></div>
    </section>

    <div className={styles.sectionTitle}><h2>System Bulletins</h2><span>From the Mystic default theme</span></div>
    <section className={styles.announcements} aria-label="System bulletins">
      <div className={styles.announcementHeader}>Announcements &amp; Welcome</div>
      <article className={styles.announcement}><h3>Welcome to Mystic BBS Software</h3><p>The archived default theme includes an introductory bulletin about Mystic BBS. This web presentation is a summary, not a rendering of its original ANSI text.</p><small>Default theme · bullet1.asc</small></article>
      <article className={styles.announcement}><h3>About This Bulletin Menu</h3><p>The default bulletin program supports multiple bulletins and new-bulletin scanning. SysOp-provided content will replace these samples when the theme adapter is connected.</p><small>Default theme · bullet2.asc</small></article>
    </section>

    <div className={styles.sectionTitle}><h2>Main Menu</h2><span>Inspired by main.mnu</span></div>
    <nav className={styles.menuGrid} aria-label="MysticWeb main menu">
      {destinations.map(item => <Link key={item.href} href={item.href} className={styles.menuItem}>
        <span className={styles.menuIcon} aria-hidden="true">{item.icon}</span>
        <strong>{item.name}</strong>
        <p>{item.description}</p>
      </Link>)}
    </nav>
    <p className={styles.note}>Prototype theme based on the archived Mystic default layout. Additional native menu commands, bulletin content, account data, and access rules are not yet connected. The welcome graphic can be replaced at public/themes/default/welcome.svg.</p>
  </Shell>;
}
