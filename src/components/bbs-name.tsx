import { Suspense } from "react";
import { configuredBbsName } from "@/lib/mystic/branding";

async function ConfiguredName() { return <>{await configuredBbsName()}</>; }

export function BbsName() {
  return <Suspense fallback="MysticWeb"><ConfiguredName /></Suspense>;
}
