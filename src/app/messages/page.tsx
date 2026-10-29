import { BbsBanner } from "@/components/bbs-banner";
import { Shell } from "@/components/shell";
import { MessageBoard } from "@/components/message-board";

export default function Page() {
  return <Shell active="/messages"><div className="eyebrow">THE BOARD / MESSAGE AREAS</div><BbsBanner /><MessageBoard /></Shell>;
}
