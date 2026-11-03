import { SidebarNavigation } from "./sidebar-navigation";
import { SessionStatus } from "./session-status";
export function Shell({ active, children }: { active: string; children: React.ReactNode }) {
 return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><SidebarNavigation active={active} /><div className="workspace"><header className="topbar"><SessionStatus location="top" /></header><main id="main">{children}</main><footer><span>MYSTICWEB <span className="footer-slash">/</span> KEEP THE CONNECTION ALIVE.</span><span>Frontend preview · No live BBS data</span></footer></div></div>;
}
