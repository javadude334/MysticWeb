// MysticWeb default dashboard script. Ordinary JavaScript, executed by
// the application in the prototype. Functions are backed by placeholder data.
// A future SysOp-editable runtime must isolate scripts before loading them.
export default async function dashboard({ ui }) {
  ui.showWelcome({
    title: "Welcome to the BBS",
    description: "Messages, files, games and community — a modern MysticWeb experience.",
  });
  ui.showBulletins({ limit: 2 });
  ui.showEmail();
  ui.showMessageStats();
  ui.showWhosOnline();
  ui.showLastCallers({ limit: 10 });
  ui.showRecentFiles({ limit: 5 });
  ui.showSystemStats();
}
