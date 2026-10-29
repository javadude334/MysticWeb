import { Suspense } from "react";
import type { Metadata } from "next";
import { configuredBbsName } from "@/lib/mystic/branding";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const name = await configuredBbsName();
  return { title: { default: name, template: `%s · ${name}` }, description: `Welcome to ${name}, powered by Mystic BBS.` };
}

async function BrandingReady() { await configuredBbsName(); return null; }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Suspense fallback={null}><BrandingReady /></Suspense>{children}</body></html>;
}
