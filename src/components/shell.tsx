import Link from "next/link";
const navigation = [
 {href:"/",name:"Dashboard",icon:"▦"},
 {href:"/messages",name:"Messages",icon:"≡"},
 {href:"/private-mail",name:"Private Mail",icon:"✉"},
 {href:"/files",name:"Files",icon:"↓"},
 {href:"/relay-chat",name:"Relay Chat",icon:"#"},
 {href:"/door-games",name:"Door Games",icon:"◇"},
 {href:"/my-profile",name:"My Profile",icon:"◎"},
];
export function Shell({ active, children }: { active: string; children: React.ReactNode }) {
 return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar"><Link className="brand" href="/" aria-label="MysticWeb home"><span className="brand-mark">M</span><span>Mystic<span className="brand-light">Web</span><small>A NEW WAY TO BBS</small></span></Link><div className="nav-label">YOUR BOARD</div><nav aria-label="Main navigation">{navigation.map(item => <Link key={item.href} href={item.href} className={active === item.href ? "nav-link active" : "nav-link"} aria-current={active === item.href ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.name}</Link>)}</nav><div className="sidebar-note"><span className="signal" /> THE SIGNAL LIVES ON<p>Built for community.<br />Inspired by the terminal.</p></div><div className="guest"><span className="avatar" aria-hidden="true">G</span><div>Guest explorer<small>Preview session</small></div></div></aside><div className="workspace"><header className="topbar"><span><span className="status-dot" /> Disconnected preview</span><Link href="/my-profile">Guest mode <span aria-hidden="true">↗</span></Link></header><main id="main">{children}</main><footer><span>MYSTICWEB <span className="footer-slash">/</span> KEEP THE CONNECTION ALIVE.</span><span>Frontend preview · No live BBS data</span></footer></div></div>;
}
