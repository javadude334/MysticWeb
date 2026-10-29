import { BbsName } from "@/components/bbs-name";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyBbsAddress } from "@/components/copy-bbs-address";
import styles from "../public.module.css";

export const metadata: Metadata = { title: "Connection help" };

export default function Connect() {
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
      <main id="main" className={styles.guideMain}>
        <section className={styles.guidePanel} aria-labelledby="connect-title">
          <span className={styles.eyebrow}><BbsName /> / GET CONNECTED</span>
          <h1 id="connect-title">Connection help</h1>
          <p>Visit the board with a Telnet-capable terminal client. If you already have one configured, launch it below.</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="telnet://davesbbs.com">Launch Telnet <span aria-hidden="true">↗</span></a>
          </div>
          <CopyBbsAddress />
          <h2>Connect in three steps</h2>
          <ol className={styles.steps}>
            <li><strong>Open a Telnet client.</strong><p>Use a terminal application that supports BBS connections. A regular browser tab cannot display a Telnet session.</p></li>
            <li><strong>Create a connection.</strong><p>Choose Telnet as the connection type and enter <code>davesbbs.com</code> as the host address.</p></li>
            <li><strong>Follow the board&apos;s prompts.</strong><p>Enter account details only inside your BBS client. This website does not collect BBS usernames or passwords.</p></li>
          </ol>
          <h2>If the link does nothing</h2>
          <p>Your device may have no application assigned to Telnet links. Open your client directly and enter the address above. If connecting fails, check the address and your network, then try again later. This page does not report live BBS availability.</p>
          <p className={styles.connectionNote}>Telnet is unencrypted, including account details and messages. Avoid using a password that you use for other services.</p>
          <h2>Prefer a browser?</h2>
          <p>Web sign-in is coming soon. Messages and account features remain disconnected while the Mystic integration is verified.</p>
          <Link className={styles.cardLink} href="/login">Web login status <span aria-hidden="true">→</span></Link>
        </section>
      </main>
      <footer className={styles.footer}><span><BbsName /> <b>/</b> KEEP THE CONNECTION ALIVE.</span><span>davesbbs.com</span></footer>
    </div>
  );
}
