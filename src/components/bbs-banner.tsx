import { Suspense } from "react";
import { configuredBbsName } from "@/lib/mystic/branding";

function Banner({ name }: { name: string }) {
  const size = Math.min(110, 1160 / (Array.from(name).length * .68));
  return <svg className="bbs-banner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 640" role="img" aria-label={`${name} — The signal lives on`}>
    <title>{name}</title>
    <defs>
      <radialGradient id="bbs-sky"><stop stopColor="#31204f" /><stop offset="1" stopColor="#0b0819" /></radialGradient>
      <linearGradient id="bbs-ink" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c674ff" /><stop offset="1" stopColor="#6ee7f2" /></linearGradient>
    </defs>
    <rect width="1600" height="640" fill="url(#bbs-sky)" />
    {Array.from({ length: 65 }, (_, i) => <circle key={i} cx={(i * 193 + 47) % 1560 + 20} cy={(i * 97 + 21) % 580 + 20} r={i % 4 === 0 ? 2 : 1} fill={i % 3 === 0 ? "#c674ff" : "#6ee7f2"} opacity={i % 2 ? .5 : .8} />)}
    <path d="M90 520H1510M160 560H1440M240 600H1360" stroke="#684080" opacity=".5" />
    <rect x="94" y="113" width="1412" height="404" rx="4" fill="#0b0819" fillOpacity=".6" stroke="#9d5ed0" />
    <path d="M94 160V113H160M1440 113H1506V160M94 470V517H160M1440 517H1506V470" fill="none" stroke="#6ee7f2" strokeWidth="4" />
    <text x="800" y="310" textAnchor="middle" fill="url(#bbs-ink)" fontFamily="Consolas, monospace" fontSize={size} fontWeight="900" letterSpacing="3">{name}</text>
    <text x="800" y="385" textAnchor="middle" fill="#ede8ff" fontFamily="monospace" fontSize="20" letterSpacing="7">THE SIGNAL LIVES ON</text>
    <text x="800" y="448" textAnchor="middle" fill="#6ee7f2" fontFamily="monospace" fontSize="15" letterSpacing="3">MESSAGES · COMMUNITY · CONNECTION</text>
  </svg>;
}

async function ConfiguredBanner() { return <Banner name={await configuredBbsName()} />; }

export function BbsBanner() {
  return <Suspense fallback={<Banner name="MysticWeb" />}><ConfiguredBanner /></Suspense>;
}
