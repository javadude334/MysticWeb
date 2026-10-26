import Link from "next/link";
import { Shell } from "./shell";

const sections = {
 "messages": { title: "Messages", label: "PUBLIC BOARDS", description: "Every good community starts with a conversation.", detail: "Message areas and threads will appear here after a public-board connection is configured. No messages have been loaded." },
 "private-mail": { title: "Private Mail", label: "PERSONAL", description: "Your conversations deserve their own space.", detail: "Private mail requires authentication and server-side authorization. This preview does not load, send, or store mail." },
 "files": { title: "Files", label: "FILE LIBRARY", description: "A little discovery goes a long way.", detail: "No files are indexed or available for download. Only explicitly approved file areas should be exposed by a future integration." },
 "relay-chat": { title: "Relay Chat", label: "REAL TIME", description: "Find the people on your wavelength.", detail: "Chat is disconnected. No live users, rooms, or conversations are displayed, and no messages are sent." },
 "door-games": { title: "Door Games", label: "PLAY", description: "There is always another adventure.", detail: "No door games are connected. Game launches and scores will require a configured, authorized backend." },
 "my-profile": { title: "My Profile", label: "YOUR CORNER", description: "Your place on the board.", detail: "You are browsing as a guest. No BBS account is connected, and no profile changes are stored." }
};

export function SectionPage({ section }: { section: keyof typeof sections }) {
  const content = sections[section];
  return (
    <Shell active={"/" + section}>
      <div className="eyebrow">THE BOARD / {content.label}</div>
      <div className="page-heading">
        <div><h1>{content.title}</h1><p>{content.description}</p></div>
      </div>
      <section className="panel destination">
        <span className="pill">FRONTEND PREVIEW · DISCONNECTED</span>
        <div className="empty-art" aria-hidden="true">[ _ ]</div>
        <h2>This space is ready for its next chapter.</h2>
        <p>{content.detail}</p>
        <Link className="button" href="/">Back to dashboard <span aria-hidden="true">↗</span></Link>
      </section>
    </Shell>
  );
}
