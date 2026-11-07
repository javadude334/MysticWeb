import type { Metadata } from "next";
import Link from "next/link";
import styles from "../public.module.css";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Web login" };

export default function Login() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Dave's BBS home">
          <span className={styles.mark} aria-hidden="true">D_</span>
          <span>Dave&apos;s <b>BBS</b><small>THE CONNECTION STARTS HERE</small></span>
        </Link>
        <Link className={styles.back} href="/">← Back to the public page</Link>
      </header>
      <main id="main" className={styles.loginMain}>
        <section className={styles.loginPanel} aria-labelledby="login-title">
          <span className={styles.eyebrow}>DAVE&apos;S BBS / WEB ACCESS</span>
          <span className={styles.loginIcon} aria-hidden="true">[ _ ]</span>
          <h1 id="login-title">Web login</h1>
          <span className={styles.badge}>MYSTIC ACCOUNT LOGIN</span>
          <p>Sign in with your Mystic BBS handle and password to access messages, files, and other member features.</p>
          <LoginForm />
          <p>For traditional access, connect to Dave&apos;s BBS using your Telnet client.</p>
          <a className={styles.primary} href="telnet://davesbbs.com">Connect via Telnet <span aria-hidden="true">↗</span></a>
          <Link className={styles.back} href="/about">About MysticWeb</Link>
          <Link className={styles.back} href="/">Return to Dave&apos;s BBS</Link>
        </section>
      </main>
      <footer className={styles.footer}><span>Dave&apos;s BBS <b>/</b> KEEP THE CONNECTION ALIVE.</span><span>davesbbs.com</span></footer>
    </div>
  );
}
