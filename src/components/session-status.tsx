"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Session = { authenticated: true; userId: number; securityLevel: number } | { authenticated: false };

export function SessionStatus({ location }: { location: "top" | "sidebar" }) {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async response => response.ok ? await response.json() as Session : { authenticated: false } as Session)
      .then(value => { if (mounted) setSession(value); })
      .catch(() => { if (mounted) setSession({ authenticated: false }); });
    return () => { mounted = false; };
  }, []);
  const active = session?.authenticated === true;
  if (location === "top") {
    return <><span><span className="status-dot" />{active ? "Mystic account connected" : session ? "Guest preview" : "Checking session..."}</span>
      <Link href={active ? "/my-profile" : "/login"}>{active ? `User #${session.userId}` : "Guest mode"} <span aria-hidden="true">↗</span></Link></>;
  }
  return <div className="guest"><span className="avatar" aria-hidden="true">{active ? "M" : "G"}</span>
    <div>{active ? `Mystic user #${session.userId}` : "Guest explorer"}<small>{active ? "Authenticated session" : "Preview session"}</small></div></div>;
}
