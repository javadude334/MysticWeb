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
  { href: "/features/bulletins", name: "System Bulletins", icon: "!", description: "Read system bulletins" },
  { href: "/features/last-callers", name: "Last 10 Callers", icon: "◷", description: "Recent visitors" },
  { href: "/features/one-liners", name: "One Liners", icon: "❞", description: "Short community messages" },
  { href: "/features/voting", name: "Voting Booth", icon: "✓", description: "Community polls" },
  { href: "/features/users", name: "User Listing", icon: "♙", description: "Find BBS users" },
  { href: "/features/bbs-list", name: "BBS Listing", icon: "⌁", description: "Explore other BBSes" },
  { href: "/features/contact-sysop", name: "Comment to SysOp", icon: "✎", description: "Send a note to the SysOp" },
  { href: "/features/page-sysop", name: "Page SysOp", icon: "☏", description: "Request a SysOp chat" },
  { href: "/features/time-bank", name: "Time Bank", icon: "◴", description: "Manage BBS time" },
  { href: "/features/usage", name: "Usage Graph", icon: "▥", description: "Usage statistics" },
  { href: "/features/demos", name: "Demos", icon: "✦", description: "BBS demos" },
  { href: "/relay-chat", name: "Node Chat", icon: "#", description: "Chat with other callers" },
  { href: "/features/whos-online", name: "Who's Online", icon: "●", description: "Active callers" },
  { href: "/features/node-message", name: "Send Node Message", icon: "➤", description: "Message an online caller" },
  { href: "/features/page-user", name: "Page User for Chat", icon: "☏", description: "Invite a user to chat" },
  { href: "/features/goodbye", name: "Goodbye", icon: "↪", description: "End your BBS visit" },
];
