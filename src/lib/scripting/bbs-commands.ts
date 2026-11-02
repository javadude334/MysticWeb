/**
 * MysticWeb scripting command contracts (safe, disconnected foundation).
 * These are server-side functions, NOT HTTP routes or a user-script sandbox.
 * Each returns an explicit unavailable result until authenticated providers exist.
 * Do not fill these with mock user/mail data in production.
 */
export type CommandResult<T> =
  | { status: "ready"; data: T }
  | { status: "unavailable"; reason: string };

export type Bulletin = { id: string; title: string; preview: string };
export type Caller = { displayName: string; node?: number };
export type MessageSummary = { id: string; subject: string; from: string };
export type DoorGame = { id: string; name: string };
export type SystemStats = { users?: number; calls?: number };

const pending = <T>(feature: string): CommandResult<T> => ({
  status: "unavailable",
  reason: `${feature} is not connected to an authorized Mystic provider yet.`,
});

export const bbsCommands = {
  getBulletins: async (): Promise<CommandResult<Bulletin[]>> => pending("Bulletins"),
  getWhosOnline: async (): Promise<CommandResult<Caller[]>> => pending("Who's Online"),
  getLastCallers: async (_limit = 10): Promise<CommandResult<Caller[]>> => pending("Last Callers"),
  listMessageAreas: async (): Promise<CommandResult<{ id: number; name: string }[]>> => pending("Message areas"),
  readMessage: async (_areaId: number, _messageId: number): Promise<CommandResult<MessageSummary>> => pending("Message reading"),
  listMail: async (): Promise<CommandResult<MessageSummary[]>> => pending("Private mail"),
  readMail: async (_messageId: string): Promise<CommandResult<MessageSummary>> => pending("Private mail reading"),
  sendMail: async (_recipient: string, _subject: string, _body: string): Promise<CommandResult<{ id: string }>> => pending("Private mail sending"),
  getRecentFiles: async (_limit = 5): Promise<CommandResult<{ name: string }[]>> => pending("Recent files"),
  getSystemStats: async (): Promise<CommandResult<SystemStats>> => pending("System statistics"),
  getDoorGames: async (): Promise<CommandResult<DoorGame[]>> => pending("Door games"),
  launchDoor: async (_gameId: string): Promise<CommandResult<{ sessionId: string }>> => pending("Door launching"),
  getOneLiners: async (): Promise<CommandResult<string[]>> => pending("One liners"),
  getVotes: async (): Promise<CommandResult<{ title: string }[]>> => pending("Voting"),
  getUserListing: async (): Promise<CommandResult<Caller[]>> => pending("User listing"),
  getBbsListing: async (): Promise<CommandResult<{ name: string }[]>> => pending("BBS listing"),
  getUsageStats: async (): Promise<CommandResult<SystemStats>> => pending("Usage statistics"),
  getNodeMessages: async (): Promise<CommandResult<MessageSummary[]>> => pending("Node messages"),
  getTimeBank: async (): Promise<CommandResult<{ minutes: number }>> => pending("Time bank"),
} as const;
