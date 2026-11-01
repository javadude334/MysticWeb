"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./login-form.module.css";

/** The server endpoint remains authoritative and unavailable until a reviewed
 * sandbox-only native adapter is composed. Never persist credentials in browser
 * storage or place them in URLs.
 */
export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ username, password }),
      });
      if (!result.ok) {
        setError("Sign-in is unavailable or the account could not be verified.");
        return;
      }
      const body: unknown = await result.json();
      if (!body || typeof body !== "object" || !("ok" in body) || body.ok !== true) {
        setError("Sign-in could not be completed.");
        return;
      }
      setPassword("");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Sign-in is currently unavailable.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor="bbs-handle">BBS handle</label>
      <input id="bbs-handle" name="username" autoComplete="username" required
        maxLength={30} value={username} onChange={e => setUsername(e.target.value)}
        disabled={busy} />
      <label htmlFor="bbs-password">Password</label>
      <input id="bbs-password" name="password" type="password" autoComplete="current-password"
        required value={password} onChange={e => setPassword(e.target.value)}
        disabled={busy} />
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "VERIFYING..." : "CONNECT TO THE BOARD  >"}</button>
      <small>Local development sign-in uses MYSTIC_DATA_ROOT. Production authentication is pending native account-policy verification.</small>
    </form>
  );
}
