import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dave's BBS", template: "%s · Dave's BBS" },
  description: "The public front door to Dave's BBS. Find Telnet access and information about upcoming web sign-in.",
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
