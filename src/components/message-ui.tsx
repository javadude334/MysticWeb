import type { ReactNode } from "react";

/** Shared message reading and composing primitives for Local Mail, NetMail and message areas. */
export function MessageAction({
  children, onClick, disabled, primary = false, type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  type?: "button" | "submit";
}) {
  return <button type={type} onClick={onClick} disabled={disabled}
    style={{
      background: primary ? "#20513d" : "#24333c",
      border: primary ? "1px solid #37654f" : "1px solid #4b5c66",
      borderRadius: "9px", color: "#fff", padding: "0.8rem 1.4rem",
      fontSize: "1rem", fontWeight: 650, minHeight: "46px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
    }}>{children}</button>;
}

export function MessageActions({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: "0.9rem", alignItems: "center",
    flexWrap: "wrap", marginTop: "0.75rem" }}>{children}</div>;
}

export function MessageField({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: "grid", gap: "0.4rem", width: "100%", fontWeight: 600 }}>
    <span>{label}</span>{children}
  </label>;
}

export const messageInputStyle = {
  display: "block", width: "100%", boxSizing: "border-box", minHeight: "42px",
  padding: "0.6rem 0.75rem", borderRadius: "6px", font: "inherit",
} as const;

export function MessageBody({ children }: { children: ReactNode }) {
  return <div style={{
    width: "100%", boxSizing: "border-box", padding: "1.1rem 1.25rem",
    border: "1px solid #40515b", borderRadius: "8px",
    background: "#121c21", color: "#f0f4f5",
    whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.65,
    minHeight: "160px",
  }}>{children}</div>;
}

export function MessageDetails({ from, to, date }: { from: string; to: string; date?: string }) {
  return <dl style={{
    display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "0.35rem 0.9rem", padding: "0.85rem 1rem",
    margin: "0 0 1rem", borderRadius: "8px", background: "#1b2a30",
    border: "1px solid #364b55",
  }}>
    <dt style={{ color: "#a9c3cc" }}>From</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{from}</dd>
    <dt style={{ color: "#a9c3cc" }}>To</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{to}</dd>
    {date && <><dt style={{ color: "#a9c3cc" }}>Date</dt><dd style={{ margin: 0 }}>{date}</dd></>}
  </dl>;
}
