import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MysticWeb · Your next connection",
  description: "A modern front door to Mystic BBS. Disconnected frontend preview.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
