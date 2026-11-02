"use client";

import { useState } from "react";
import styles from "./bbs-dashboard.module.css";

const screens = [
  { title: "WELCOME", lines: ["DAVE'S BBS", "THE CONNECTION STARTS HERE", "Welcome back, caller.", "Enjoy your stay on the board."] },
  { title: "BULLETINS", lines: ["SYSTEM BULLETINS", "Welcome to the MysticWeb concept preview.", "Announcements will be loaded from Mystic's native bulletin files."] },
  { title: "BOARD STATISTICS", lines: ["SYSTEM STATISTICS", "Callers today: awaiting native data", "Messages: awaiting native data", "Files: awaiting native data"] },
  { title: "PRIVATE MAIL", lines: ["CHECKING PRIVATE MAIL", "Private-mail status: unavailable in prototype.", "No mailbox was accessed."] },
  { title: "MAIN MENU", lines: ["[M] Message Boards", "[P] Private Mail", "[F] File Areas", "[D] Door Games", "Select a destination from the menu below."] },
] as const;

export function BbsWelcomeSequence() {
  const [step, setStep] = useState(0);
  const screen = screens[step];
  return <section className={styles.terminalFrame} aria-label="Interactive BBS welcome sequence prototype">
    <div className={styles.terminalBar}><span>● ● ●</span><span>DAVE&apos;S BBS / CONCEPT SESSION</span><span>ANSI STYLE</span></div>
    <div className={styles.screen}>
      <pre className={styles.banner}>{`╔═══════════════════════════════════════════╗
║            D A V E ' S   B B S          ║
╚═══════════════════════════════════════════╝`}</pre>
      <p className={styles.prompt}>[ {screen.title} ]</p>
      {screen.lines.map(line => <p key={line}><span className={styles.label}>&gt; </span>{line}</p>)}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} style={buttonStyle}>← BACK</button>}
        <button type="button" onClick={() => setStep(step === screens.length - 1 ? 0 : step + 1)} style={buttonStyle}>
          {step === screens.length - 1 ? "REPLAY SEQUENCE" : "CONTINUE →"}
        </button>
        {step < screens.length - 1 && <button type="button" onClick={() => setStep(screens.length - 1)} style={buttonStyle}>SKIP TO MENU »</button>}
      </div>
    </div>
    <div className={styles.terminalFoot}>INTERACTIVE PROTOTYPE · SCREEN {step + 1} / {screens.length} · SAMPLE CONTENT ONLY</div>
  </section>;
}

const buttonStyle = { border: "1px solid #70e4cc", background: "#132b3e", color: "#e0fff1", padding: "10px 14px", font: "bold 12px monospace", cursor: "pointer" } as const;
