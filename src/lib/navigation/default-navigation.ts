// MysticWeb navigation is independent of Mystic's .mnu execution flow.
// Labels are seeded from the archived default Mystic main menu.
export type NavigationItem = { href: string; name: string; icon: string; description: string; enabled?: boolean };
export const defaultNavigation: NavigationItem[] = [
  { href: "/dashboard", name: "Dashboard", icon: "▦", description: "Your BBS home" },
  { href: "/messages", name: "Message Menu", icon: "≡", description: "Message groups and boards" },
  { href: "/private-mail", name: "Private Mail", icon: "✉", description: "Local BBS email" },
  { href: "/files", name: "File Areas", icon: "↓", description: "Browse and download files" },
  { href: "/door-games", name: "Door Games", icon: "◇", description: "Play door games" },
  { href: "/my-profile", name: "Account Settings", icon: "◎", description: "Manage your account" },
  { href: "/bulletins", name: "System Bulletins", icon: "!", description: "Read system bulletins" },
  { href: "/last-callers", name: "Last 10 Callers", icon: "◷", description: "Recent visitors" },
  { href: "/one-liners", name: "One Liners", icon: "❞", description: "Short community messages" },
  { href: "/voting", name: "Voting Booth", icon: "✓", description: "Community polls" },
  { href: "/users", name: "User Listing", icon: "♙", description: "Find BBS users" },
  { href: "/bbs-list", name: "BBS Listing", icon: "⌁", description: "Explore other BBSes" },
  { href: "/contact-sysop", name: "Comment to SysOp", icon: "✎", description: "Send a note to the SysOp" },
  { href: "/page-sysop", name: "Page SysOp", icon: "☏", description: "Request a SysOp chat" },
  { href: "/time-bank", name: "Time Bank", icon: "◴", description: "Manage BBS time" },
  { href: "/usage", name: "Usage Graph", icon: "▥", description: "Usage statistics" },
  { href: "/demos", name: "Demos", icon: "✦", description: "BBS demos" },
  { href: "/relay-chat", name: "Node Chat", icon: "#", description: "Chat with other callers" },
  { href: "/whos-online", name: "Who's Online", icon: "●", description: "Active callers" },
  { href: "/node-message", name: "Send Node Message", icon: "➤", description: "Message an online caller" },
  { href: "/page-user", name: "Page User for Chat", icon: "☏", description: "Invite a user to chat" },
  { href: "/goodbye", name: "Goodbye", icon: "↪", description: "End your BBS visit" },
];
