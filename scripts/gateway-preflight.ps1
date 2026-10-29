# Metadata-only MysticGateway preflight. No native execution or account contents.
$ErrorActionPreference = 'Stop'
$root = 'E:\mystic'
$repo = Split-Path -Parent $PSScriptRoot
function Add([string]$s) { Write-Output $s }
function CheckPath([string]$path, [switch]$Optional) {
  $full = [IO.Path]::GetFullPath($path)
  $volume = [IO.Path]::GetPathRoot($full)
  if ($volume -notmatch '^[A-Za-z]:\\$') { throw 'Only local absolute drive paths are supported' }
  $current = $volume
  $parts = $full.Substring($volume.Length).Split([char]'\', [StringSplitOptions]::RemoveEmptyEntries)
  $item = Get-Item -LiteralPath $volume -Force -ErrorAction Stop
  foreach ($part in $parts) {
    $current = Join-Path $current $part
    # Inspect each ancestor before traversing it, including optional missing files.
    $item = Get-Item -LiteralPath $current -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) {
      if ($Optional -and -not (Test-Path -LiteralPath $current)) { return $null }
      throw "Missing or inaccessible: $current"
    }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Refusing reparse point: $current"
    }
  }
  return $item
}
try {
  $r = CheckPath $root
  $p = CheckPath $repo
  if ($r.FullName -ne 'E:\mystic' -or -not $r.PSIsContainer -or -not $p.PSIsContainer) { throw 'Unexpected directories' }
  Add 'MysticGateway metadata-only preflight'
  Add ('Date UTC: ' + [DateTime]::UtcNow.ToString('u'))
  Add ('Windows: ' + [Environment]::OSVersion.VersionString)
  Add ('PowerShell: ' + $PSVersionTable.PSVersion.ToString())
  foreach ($name in @('mystic.exe','mystic64.exe','mystic.dat','data\users.dat','docs\records.112')) {
    $f = CheckPath (Join-Path $root $name) -Optional
    if ($null -eq $f) {
      if ($name -in @('mystic.exe','mystic.dat','data\users.dat','docs\records.112')) { throw "Required sandbox file missing: $name" }
      Add ("Absent $name")
    } else {
      if ($f.PSIsContainer) { throw "Expected a file: $name" }
      Add ("Found $name; bytes=$($f.Length)")
    }
  }
  foreach ($cmd in @('fpc','go','gcc','git','node')) {
    $found = Get-Command $cmd -CommandType Application -ErrorAction SilentlyContinue
    Add ("Tool $cmd : " + $(if ($found) { 'available' } else { 'not found' }))
  }
  Add 'Preflight complete. No native code executed and no BBS records read.'
  Add 'NOT CERTIFIED: path checks are not an atomic boundary or a config/service audit.'
  exit 0
} catch {
  Add ('Preflight stopped: ' + $_.Exception.Message)
  exit 1
}
