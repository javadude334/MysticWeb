/** Ordered navigation collections, modeled after PeopleSoft Navigation Collections.
 * A collection may contain links or other collections. This is presentation
 * metadata only: every destination must enforce authorization on the server.
 */
export type CollectionLink = { type: "link"; href: string };
export type CollectionFolder = {
  type: "collection"; id: string; title: string; icon: string;
  children: readonly CollectionNode[];
};
export type CollectionNode = CollectionLink | CollectionFolder;

export const navigationCollections: readonly CollectionFolder[] = [
  { type: "collection", id: "messages", title: "Message Center", icon: "✉", children: [
    { type: "link", href: "/messages" }, { type: "link", href: "/private-mail" },
  ] },
  { type: "collection", id: "files", title: "Files & Downloads", icon: "▣", children: [
    { type: "link", href: "/files" }, { type: "link", href: "/door-games" },
  ] },
  { type: "collection", id: "community", title: "Community", icon: "♧", children: [
    { type: "collection", id: "community-presence", title: "Callers & Chat", icon: "●", children: [
      { type: "link", href: "/features/whos-online" }, { type: "link", href: "/features/last-callers" },
      { type: "link", href: "/relay-chat" }, { type: "link", href: "/features/node-message" },
      { type: "link", href: "/features/page-user" },
    ] },
    { type: "collection", id: "community-participation", title: "Community Activities", icon: "✓", children: [
      { type: "link", href: "/features/one-liners" }, { type: "link", href: "/features/voting" },
      { type: "link", href: "/features/users" }, { type: "link", href: "/features/bbs-list" },
    ] },
  ] },
  { type: "collection", id: "board", title: "Board & SysOp", icon: "◇", children: [
    { type: "collection", id: "board-information", title: "Information", icon: "▤", children: [
      { type: "link", href: "/news" }, { type: "link", href: "/features/bulletins" },
      { type: "link", href: "/features/usage" }, { type: "link", href: "/features/demos" },
    ] },
    { type: "collection", id: "board-contact", title: "Contact SysOp", icon: "✎", children: [
      { type: "link", href: "/features/contact-sysop" }, { type: "link", href: "/features/page-sysop" },
    ] },
    { type: "link", href: "/features/time-bank" }, { type: "link", href: "/features/goodbye" },
  ] },
  { type: "collection", id: "account", title: "Account", icon: "◎", children: [
    { type: "link", href: "/my-profile" },
  ] },
];

export function collectionIds(nodes: readonly CollectionNode[] = navigationCollections): string[] {
  return nodes.flatMap(node => node.type === "collection" ? [node.id, ...collectionIds(node.children)] : []);
}
