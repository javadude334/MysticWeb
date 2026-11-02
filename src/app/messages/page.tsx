import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { MessageWorkspace } from "@/components/message-workspace";

export const metadata: Metadata = { title: "Message Areas" };

export default function Page() {
  return <Shell active="/messages">
    <div className="eyebrow">THE BOARD / PUBLIC ECHO MAIL</div>
    <div className="page-heading"><div><h1>Messages</h1><p>Browse the echo areas your Mystic account can read.</p></div></div>
    <MessageWorkspace />
  </Shell>;
}
