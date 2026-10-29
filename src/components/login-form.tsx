"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./login-form.module.css";

/** Render only when the server has a certified, explicitly composed WebAccess. */
export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError("");
    const form = event.currentTarget;
    const input = new FormData(form);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const result = await fetch("/api/auth/login", {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ username: input.get("username"), password: input.get("password") }),
      });
      input.delete("password");
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      if (result.status === 200 && (await result.json()).ok === true) {
        window.location.replace("/messages");
        return;
      }
      setError(result.status === 429 ? "Too many attempts. Please wait before trying again." :
        result.status === 503 ? "Sign-in is temporarily unavailable. Please try again later." :
        "Sign-in was not accepted. Check your account details or contact the sysop.");
    } catch { setError("Could not complete sign-in. Please try again."); }
    finally {
      clearTimeout(timeout); input.delete("password");
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      submitting.current = false; setPending(false);
    }
  }

  return <form className={styles.form} onSubmit={submit} aria-busy={pending}>
    <label htmlFor="bbs-username">BBS account name</label>
    <input id="bbs-username" name="username" autoComplete="username" maxLength={120} required disabled={pending} />
    <label htmlFor="bbs-password">Password</label>
    <input id="bbs-password" name="password" type="password" autoComplete="current-password" maxLength={256} required disabled={pending} />
    <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in and read messages"}</button>
    <p role="alert" aria-live="polite">{error}</p>
  </form>;
}
