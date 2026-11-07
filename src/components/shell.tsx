import { SidebarNavigation } from "./sidebar-navigation";
import { SessionStatus } from "./session-status";

export function Shell({ active, children }: { active: string; children: React.ReactNode }) {
 return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><SidebarNavigation active={active} /><div className="workspace"><header className="topbar"><SessionStatus location="top" /></header><main id="main">{children}</main><footer style={{ flexWrap: "wrap", lineHeight: 1.8 }}>
 <span>MYSTICWEB <span className="footer-slash">/</span> KEEP THE CONNECTION ALIVE.</span>
 <span>© 2026 <a href="https://javadude.dev" target="_blank" rel="noopener noreferrer">Javadude Development</a> · Open source · <a href="https://github.com/javadude334/MysticWeb" target="_blank" rel="noopener noreferrer">Source</a></span>
 <span>Independent interface for <a href="https://mysticbbs.com/" target="_blank" rel="noopener noreferrer">Mystic BBS</a> by James Coyle (g00r00). Not affiliated or endorsed.</span>
 </footer></div></div>;
}
