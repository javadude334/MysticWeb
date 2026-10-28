import Link from "next/link";
import styles from "./public.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Dave's BBS home">
          <span className={styles.mark} aria-hidden="true">D_</span>
          <span>Dave&apos;s <b>BBS</b><small>THE CONNECTION STARTS HERE</small></span>
        </Link>
        <nav className={styles.nav} aria-label="Public navigation">
          <a href="#about">About</a>
          <a href="#connect">Connect</a>
          <Link href="/connect">Connection help</Link>
          <Link href="/login">Web login <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <main id="main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="welcome">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>D A V E S B B S . C O M</span>
            <h1 id="welcome">A classic connection.<br /><span>A place to belong.</span></h1>
            <p>Welcome to Dave&apos;s BBS. Step into the world of bulletin boards, where the terminal has a personality and every connection starts with a hello.</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="telnet://davesbbs.com">Connect via Telnet <span aria-hidden="true">↗</span></a>
              <Link className={styles.secondary} href="/login">Web login <span aria-hidden="true">→</span></Link>
            </div>
            <span className={styles.hint}>Telnet client required · Web sign-in coming soon</span>
          </div>
          <div className={styles.terminal} aria-hidden="true">
            <div className={styles.terminalTop}><span>DAVESBBS.COM</span><span>● ● ●</span></div>
            <div className={styles.terminalArt}>
              <pre>{"████▄   ▄▄▄  ▄   ▄ █████\n█   █  █   █ █   █ █\n█   █  █████ ▀▄ ▄▀ ████\n█   █  █   █  ███  █\n████▀  █   █   █   █████"}</pre>
              <span>B U L L E T I N   B O A R D   S Y S T E M</span>
            </div>
            <div className={styles.terminalPrompt}><span>&gt;</span> The next conversation starts with you.<b>▌</b></div>
          </div>
        </section>

        <section id="about" className={styles.about} aria-labelledby="about-title">
          <span className={styles.eyebrow}>THE BOARD BEHIND THE ADDRESS</span>
          <div className={styles.aboutContent}>
            <h2 id="about-title">Old-school spirit.<br />An open invitation.</h2>
            <p>Dave&apos;s BBS is powered by Mystic BBS. This page is the public front door: a place to find the board and choose how to connect. Use a Telnet-capable terminal client for traditional access. Browser-based sign-in is being developed.</p>
          </div>
        </section>

        <section id="connect" className={styles.connect} aria-labelledby="connect-title">
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>PICK YOUR CONNECTION</span><h2 id="connect-title">Meet you on the board.</h2></div><span className={styles.sectionNumber}>01 / CONNECT</span></div>
          <div className={styles.cards}>
            <article className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">&gt;_</span>
              <span className={styles.eyebrow}>THE TERMINAL EXPERIENCE</span>
              <h3>Telnet access</h3>
              <p>Open Dave&apos;s BBS in your configured Telnet client. Prefer to enter the address yourself? Use <code>davesbbs.com</code>.</p>
              <a className={styles.cardLink} href="telnet://davesbbs.com">Launch Telnet <span aria-hidden="true">↗</span></a>
              <Link className={styles.cardLink} href="/connect">Need help connecting? <span aria-hidden="true">→</span></Link>
              <small>Telnet uses an unencrypted connection.</small>
            </article>
            <article className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">◎</span>
              <span className={styles.eyebrow}>IN YOUR BROWSER · COMING SOON</span>
              <h3>HTTPS web login</h3>
              <p>A browser-based way to sign in is on the way. Web authentication must be connected before account features and messages become available.</p>
              <Link className={styles.cardLink} href="/login">Go to web login <span aria-hidden="true">→</span></Link>
              <small>Web sign-in is not available yet.</small>
            </article>
          </div>
        </section>
      </main>
      <footer className={styles.footer}><span>Dave&apos;s BBS <b>/</b> KEEP THE CONNECTION ALIVE.</span><span>davesbbs.com</span></footer>
    </div>
  );
}
