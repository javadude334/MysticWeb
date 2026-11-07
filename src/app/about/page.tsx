import type { Metadata } from "next";
import Link from "next/link";
import styles from "../public.module.css";
export const metadata: Metadata = { title: "About MysticWeb" };
export default function About() {
  return <div className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/">Dave&apos;s <b>BBS</b></Link>
      <nav className={styles.nav}><Link href="/">Home</Link><Link href="/login">Web login</Link></nav></header>
    <main className={styles.main}><section className={styles.about}>
      <div className={styles.aboutContent}><h1>About MysticWeb</h1>
      <p>MysticWeb is a web interface for Mystic BBS, developed by Javadude Development. Members sign in using their Mystic BBS account to access the board.</p>
      <p>MysticWeb is independent of the Mystic BBS project and is not affiliated with or endorsed by its creator.</p>
      <Link href="/login">Sign in to MysticWeb</Link></div></section></main>
  </div>;
}