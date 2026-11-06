import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { LocalMailWorkspace } from "@/components/local-mail-workspace";

export const metadata: Metadata = { title: "Mystic Mail — Local Mail" };
export default function Page() {
  return <Shell active="/mail">
    <div className="eyebrow">THE BOARD / PRIVATE LOCAL MAIL</div>
    <div className="page-heading"><div>
      <h1>Mystic Mail</h1>
      <p>Read and send private messages to other Mystic users.</p>
    </div></div>
    <LocalMailWorkspace />
  </Shell>;
}
