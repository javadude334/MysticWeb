// MysticWeb navigation is independent of Mystic's .mnu execution flow.
// Labels are seeded from the archived default Mystic main menu.
import type { bbsCommands } from "@/lib/scripting/bbs-commands";
export type NavigationItem = { href: string; name: string; icon: string; description: string; enabled?: boolean; command?: keyof typeof bbsCommands };
export const defaultNavigation: NavigationItem[] = [
  { href: "/dashboard", name: "Dashboard", icon: "▦", description: "Your BBS home" },
  { href: "/messages", name: "Message Menu", icon: "≡", description: "Message groups and boards", command: "listMessageAreas" },
  { href: "/private-mail", name: "Private Mail", icon: "✉", description: "Local BBS email", command: "listMail" },
  { href: "/files", name: "File Areas", icon: "↓", description: "Browse and download files", command: "getRecentFiles" },
  { href: "/door-games", name: "Door Games", icon: "◇", description: "Play door games", command: "getDoorGames" },
  { href: "/my-profile", name: "Account Settings", icon: "◎", description: "Manage your account" },
  { href: "/news", name: "News", icon: "▤", description: "BBC, NPR, Fox News and Christian Science Monitor" },
  { href: "/features/bulletins", name: "System Bulletins", icon: "!", description: "Read system bulletins", command: "getBulletins" },
  { href: "/features/last-callers", name: "Last 10 Callers", icon: "◷", description: "Recent visitors", command: "getLastCallers" },
  { href: "/features/one-liners", name: "One Liners", icon: "❞", description: "Short community messages", command: "getOneLiners" },
  { href: "/features/voting", name: "Voting Booth", icon: "✓", description: "Community polls", command: "getVotes" },
  { href: "/features/users", name: "User Listing", icon: "♙", description: "Find BBS users", command: "getUserListing" },
  { href: "/features/bbs-list", name: "BBS Listing", icon: "⌁", description: "Explore other BBSes", command: "getBbsListing" },
  { href: "/features/contact-sysop", name: "Comment to SysOp", icon: "✎", description: "Send a note to the SysOp" },
  { href: "/features/page-sysop", name: "Page SysOp", icon: "☏", description: "Request a SysOp chat" },
  { href: "/features/time-bank", name: "Time Bank", icon: "◴", description: "Manage BBS time", command: "getTimeBank" },
  { href: "/features/usage", name: "Usage Graph", icon: "▥", description: "Usage statistics", command: "getUsageStats" },
  { href: "/features/demos", name: "Demos", icon: "✦", description: "BBS demos" },
  { href: "/relay-chat", name: "Node Chat", icon: "#", description: "Chat with other callers" },
  { href: "/features/whos-online", name: "Who's Online", icon: "●", description: "Active callers", command: "getWhosOnline" },
  { href: "/features/node-message", name: "Send Node Message", icon: "➤", description: "Message an online caller", command: "getNodeMessages" },
  { href: "/features/page-user", name: "Page User for Chat", icon: "☏", description: "Invite a user to chat" },
  { href: "/features/goodbye", name: "Goodbye", icon: "↪", description: "End your BBS visit" },
];
