import Link from "next/link";
import { Shell } from "@/components/shell";
const areas = [
  { href: "/messages", icon: "≡", name: "Messages", text: "Find your next conversation.", tag: "PUBLIC BOARDS" },
  { href: "/private-mail", icon: "✉", name: "Private Mail", text: "A space for direct connections.", tag: "PERSONAL" },
  { href: "/files", icon: "↓", name: "Files", text: "Explore the digital archive.", tag: "FILE LIBRARY" },
  { href: "/relay-chat", icon: "#", name: "Relay Chat", text: "Drop into the conversation.", tag: "REAL TIME" },
  { href: "/door-games", icon: "◇", name: "Door Games", text: "One more turn. One more adventure.", tag: "PLAY" },
  { href: "/my-profile", icon: "◎", name: "My Profile", text: "Make yourself at home.", tag: "YOUR CORNER" },
];
export default function Dashboard() {
  return <Shell active="/">
    <div className="eyebrow">THE BOARD / OVERVIEW</div>
    <div className="page-heading"><div><h1>Your next connection<br /><span>starts here.</span></h1><p>Old-school spirit. A whole new front door.</p></div><span className="edition">EST. IN THE TERMINAL<br />REIMAGINED FOR THE WEB</span></div>
    <section className="hero" aria-labelledby="welcome"><div className="hero-copy"><span className="pill">FRONTEND PREVIEW · DISCONNECTED</span><h2 id="welcome">Welcome to<br />the neighborhood.</h2><p>Good conversations, shared discoveries, and a little friendly competition. Explore the familiar world of BBS, at your own pace.</p><Link className="button" href="/messages">Explore message boards <span aria-hidden="true">↗</span></Link></div><div className="ansi" aria-hidden="true"><div className="orbit one" /><div className="orbit two" /><pre>{"     ▄▄▄       ▄▄▄\n   ▄█████▄   ▄█████▄\n  ███▀ ▀███▄███▀ ▀███\n  ███   ▀█████▀   ███\n  ███     ███     ███\n  ███             ███\n  ▀▀▀             ▀▀▀"}</pre><span>M Y S T I C / W E B</span></div></section>
    <div className="section-heading"><h2>Find your frequency</h2><span>06 DESTINATIONS</span></div>
    <section className="area-grid" aria-label="Explore the board">{areas.map((area) => <Link className="area-card" href={area.href} key={area.href}><div className="card-top"><span className="area-icon" aria-hidden="true">{area.icon}</span><span className="arrow" aria-hidden="true">↗</span></div><span className="eyebrow">{area.tag}</span><h3>{area.name}</h3><p>{area.text}</p><span className="card-status">Preview · not connected</span></Link>)}</section>
    <section className="bottom-grid"><div className="panel"><span className="eyebrow">ACTIVITY FEED</span><h2>A quiet board, for now.</h2><p>No live activity is loaded. Messages, callers, and file counts will appear only after an authorized BBS connection is configured.</p><span className="empty-line"><i /> Awaiting connection</span></div><div className="panel terminal"><div className="terminal-title"><span>CONNECTION NOTES</span><span aria-hidden="true">● ● ●</span></div><p><b>&gt;</b> Interface ready to explore</p><p><b>&gt;</b> BBS connection not configured</p><p><b>&gt;</b> No account signed in</p><p className="cursor"><b>&gt;</b> The next chapter is yours<span aria-hidden="true"> ▋</span></p></div></section>
  </Shell>;
}
