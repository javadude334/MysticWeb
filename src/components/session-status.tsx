"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Session = { authenticated: true; userId: number; securityLevel?: number; handle?: string | null } | { authenticated: false };

export function SessionStatus({ location }: { location: "top" | "sidebar" }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async response => response.ok ? await response.json() as Session : { authenticated: false } as Session)
      .then(value => { if (mounted) setSession(value); })
      .catch(() => { if (mounted) setSession({ authenticated: false }); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Logout failed");
      setOpen(false);
      setSession({ authenticated: false });
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }
  const active = session?.authenticated === true;
  if (location === "top") {
    return <><span><span className="status-dot" />{active ? "Mystic account connected" : session ? "Guest preview" : "Checking session..."}</span>
      {active ? <div className="account-menu" ref={menu}>
        <button type="button" className="account-menu-trigger" aria-haspopup="menu" aria-expanded={open}
          onClick={() => setOpen(value => !value)}>{session.handle || `User #${session.userId}`} <span aria-hidden="true">▾</span></button>
        {open && <div className="account-menu-panel" role="menu">
          <Link role="menuitem" href="/my-profile" onClick={() => setOpen(false)}>My Profile</Link>
          <button type="button" role="menuitem" disabled={loggingOut} onClick={logout}>{loggingOut ? "Logging out..." : "Logout"}</button>
          {error && <span role="alert" className="account-menu-error">{error}</span>}
        </div>}
      </div> : <Link href="/login">Guest mode <span aria-hidden="true">↗</span></Link>}
    </>;
  }
  return <div className="guest"><span className="avatar" aria-hidden="true">{active ? "M" : "G"}</span>
    <div>{active ? (session.handle || `Mystic user #${session.userId}`) : "Guest explorer"}<small>{active ? "Authenticated session" : "Preview session"}</small></div></div>;
}
