import { notFound } from "next/navigation";
import { developmentEnabled } from "@/lib/auth/development";
import { DevelopmentBoard } from "@/components/development-board";

export default function DevelopmentPage() {
  if (!developmentEnabled()) notFound();
  return <DevelopmentBoard />;
}
