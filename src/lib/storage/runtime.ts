import "server-only";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { AuthStore } from "../auth/store";
import { mysticDirectories, type MysticDirectories } from "../mystic/directories";

export interface MysticWebRuntime {
  readonly directories: MysticDirectories;
  readonly databasePath: string;
  readonly usersPath: string;
  readonly rateKey: Buffer;
}

let cached: MysticWebRuntime | undefined;

// The BBS data directory may contain files readable by ordinary BBS users.
// Keep credentials and sessions in a *private child directory* instead of
// changing the ACLs of Mystic's shared data directory.
function privateDatabaseDirectory(dataDir: string): string {
  if (process.platform !== "win32") {
    throw new Error("Automatic Mystic A47 Windows storage is not supported on this host");
  }
  const root = realpathSync.native(dataDir);
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Invalid Mystic data directory");
  const dir = path.win32.join(root, "mysticweb");
  try { mkdirSync(dir, { recursive: false, mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const entry = lstatSync(dir);
  if (!entry.isDirectory() || entry.isSymbolicLink() ||
      realpathSync.native(dir).toLowerCase() !== dir.toLowerCase()) {
    throw new Error("Unsafe MysticWeb database directory");
  }
  // Windows-specific: refuse removable/network filesystems, and install a
  // protected ACL allowing only this process identity and SYSTEM. This must
  // succeed before SQLite can create a journal or database file.
  const script = [
    "$ErrorActionPreference='Stop'",
    "$p=$env:MYSTICWEB_SECURE_DIR",
    "$drive=[System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot($p))",
    "if ($drive.DriveType -ne [System.IO.DriveType]::Fixed) { throw 'Local fixed disk required' }",
    "$me=[System.Security.Principal.WindowsIdentity]::GetCurrent().User",
    "$system=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')",
    "$acl=Get-Acl -LiteralPath $p",
    "$acl.SetAccessRuleProtection($true,$false)",
    "foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }",
    "foreach ($sid in @($me,$system)) {",
    "  $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')",
    "  $acl.SetAccessRule($rule)",
    "}",
    "Set-Acl -LiteralPath $p -AclObject $acl",
    "$check=Get-Acl -LiteralPath $p",
    "if (-not $check.AreAccessRulesProtected) { throw 'ACL inheritance not disabled' }",
    "foreach ($rule in $check.Access) {",
    "  $sid=$rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value",
    "  if ($sid -ne $me.Value -and $sid -ne $system.Value) { throw 'Unexpected database ACL principal' }",
    "}"
  ].join("; ");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: { ...process.env, MYSTICWEB_SECURE_DIR: dir }, timeout: 10000,
    windowsHide: true, stdio: "pipe",
  });
  return dir;
}

/**
 * Initializes configuration, private SQLite storage and rate key once per
 * Node process. AuthStore is opened per request to avoid leaking a connection
 * across development hot reloads.
 */
export function initializeMysticWebRuntime(): MysticWebRuntime {
  if (cached) return cached;
  const directories = mysticDirectories();
  const dbDir = privateDatabaseDirectory(directories.dataDir);
  const databasePath = path.win32.join(dbDir, "mysticweb.db");
  const store = new AuthStore(databasePath);
  let rateKey: Buffer;
  try {
    // Migration bridge: retain the previous rate key on the first launch.
    // Once stored, remove the legacy environment variable. A mismatched key
    // fails closed rather than silently resetting rate limits.
    const legacy = process.env.MYSTICWEB_RATE_KEY;
    if (legacy && !/^[a-f0-9]{64}$/i.test(legacy)) throw new Error("Invalid legacy rate key");
    rateKey = store.getOrCreateRateKey(legacy ? Buffer.from(legacy, "hex") : undefined);
  } finally {
    store.close();
  }
  cached = Object.freeze({
    directories, databasePath,
    usersPath: path.win32.join(directories.dataDir, "users.dat"),
    rateKey,
  });
  return cached;
}
