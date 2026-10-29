import { Suspense } from "react";
import { connection } from "next/server";
import { productionAccess } from "@/lib/auth/service";
import { LoginForm } from "@/components/login-form";
import { BbsName } from "@/components/bbs-name";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "../public.module.css";

export const metadata: Metadata = { title: "Web login" };

export default function Login() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Board home">
          <span className={styles.mark} aria-hidden="true">M_</span>
          <span><BbsName /><small>THE CONNECTION STARTS HERE</small></span>
        </Link>
        <Link className={styles.back} href="/">← Back to the public page</Link>
      </header>
      <main id="main" className={styles.loginMain}>
        <section className={styles.loginPanel} aria-labelledby="login-title">
          <span className={styles.eyebrow}><BbsName /> / WEB ACCESS</span>
          <span className={styles.loginIcon} aria-hidden="true">[ _ ]</span>
          <h1 id="login-title">Web login</h1>
          <Suspense fallback={<p>Checking sign-in availability…</p>}><LoginAvailability /></Suspense>
          <p>For traditional access, connect to <BbsName /> using your Telnet client.</p>
          <a className={styles.primary} href="telnet://davesbbs.com">Connect via Telnet <span aria-hidden="true">↗</span></a>
          <Link className={styles.back} href="/connect">Need help connecting?</Link>
          <Link className={styles.back} href="/">Return to <BbsName /></Link>
        </section>
      </main>
      <footer className={styles.footer}><span><BbsName /> <b>/</b> KEEP THE CONNECTION ALIVE.</span><span>davesbbs.com</span></footer>
    </div>
  );
}

async function LoginAvailability() {
  await connection();
  if (productionAccess()) return <LoginForm />;
  return <>
    <span className={styles.badge}>SIGN-IN UNAVAILABLE</span>
    <p>Web sign-in is being connected to Mystic accounts. It is not available yet, and this page does not collect usernames or passwords.</p>
  </>;
}