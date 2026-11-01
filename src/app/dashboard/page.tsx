import Link from "next/link";
import { Shell } from "@/components/shell";
import styles from "./bbs-dashboard.module.css";
const areas = [
  { href: "/messages", icon: "≡", name: "Messages", text: "Find your next conversation.", tag: "PUBLIC BOARDS" },
  { href: "/private-mail", icon: "✉", name: "Private Mail", text: "A space for direct connections.", tag: "PERSONAL" },
  { href: "/files", icon: "↓", name: "Files", text: "Explore the digital archive.", tag: "FILE LIBRARY" },
  { href: "/relay-chat", icon: "#", name: "Relay Chat", text: "Drop into the conversation.", tag: "REAL TIME" },
  { href: "/door-games", icon: "◇", name: "Door Games", text: "One more turn. One more adventure.", tag: "PLAY" },
  { href: "/my-profile", icon: "◎", name: "My Profile", text: "Make yourself at home.", tag: "YOUR CORNER" },
];
export default function Dashboard() {
  return <Shell active="/dashboard">
    <div className={styles.terminalFrame} aria-label="BBS welcome and prelogin sequence preview">
      <div className={styles.terminalBar}><span>● ● ●</span><span>DAVE'S BBS / TERMINAL SESSION</span><span>80 × 25 STYLE</span></div>
      <div className={styles.screen}>
        <pre className={styles.banner}>{`╔══════════════════════════════════════════════════╗
║            D A V E ' S   B B S                 ║
║          THE CONNECTION STARTS HERE              ║
╚══════════════════════════════════════════════════╝`}</pre>
        <p className={styles.prompt}>[ SYSTEM ] Welcome to the board.</p>
        <p><span className={styles.label}>[ BULLETINS ]</span> Board announcements will appear here when configured.</p>
        <p><span className={styles.label}>[ STATISTICS ]</span> Live caller and message statistics are not connected.</p>
        <p><span className={styles.label}>[ PRIVATE MAIL ]</span> Mail status unavailable until authorized native checks are implemented.</p>
        <p className={styles.prompt}>[ MAIN MENU ] Choose your destination below <span aria-hidden="true">▋</span></p>
      </div>
      <div className={styles.terminalFoot}>ANSI-INSPIRED WEB VIEW · PRELOGIN SEQUENCE PREVIEW · NO LIVE BBS DATA</div>
    </div>
    <div className="section-heading"><h2>Main Menu</h2><span>06 DESTINATIONS</span></div>
    <section className="area-grid" aria-label="Explore the board">{areas.map((area) => <Link className="area-card" href={area.href} key={area.href}><div className="card-top"><span className="area-icon" aria-hidden="true">{area.icon}</span><span className="arrow" aria-hidden="true">↗</span></div><span className="eyebrow">{area.tag}</span><h3>{area.name}</h3><p>{area.text}</p><span className="card-status">Preview · not connected</span></Link>)}</section>
    <section className="bottom-grid"><div className="panel"><span className="eyebrow">ACTIVITY FEED</span><h2>A quiet board, for now.</h2><p>No live activity is loaded. Messages, callers, and file counts will appear only after an authorized BBS connection is configured.</p><span className="empty-line"><i /> Awaiting connection</span></div><div className="panel terminal"><div className="terminal-title"><span>CONNECTION NOTES</span><span aria-hidden="true">● ● ●</span></div><p><b>&gt;</b> Interface ready to explore</p><p><b>&gt;</b> BBS connection not configured</p><p><b>&gt;</b> No account signed in</p><p className="cursor"><b>&gt;</b> The next chapter is yours<span aria-hidden="true"> ▋</span></p></div></section>
  </Shell>;
}
