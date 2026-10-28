"use client";

import { useState } from "react";
import styles from "@/app/public.module.css";

export function CopyBbsAddress() {
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText("davesbbs.com");
      setStatus("Address copied. Paste it into your Telnet client.");
    } catch {
      setStatus("Copy is unavailable. Select and copy davesbbs.com above.");
    }
  }

  return (
    <div className={styles.copyAddress}>
      <span className={styles.eyebrow}>BBS ADDRESS</span>
      <code>davesbbs.com</code>
      <button type="button" className={styles.secondary} onClick={copy}>Copy BBS address</button>
      <p role="status" aria-live="polite">{status}</p>
    </div>
  );
}
