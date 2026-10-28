# Read-only MysticGateway preflight. No secrets, record bytes, or production paths collected.
$ErrorActionPreference = 'Stop'
$root = 'E:\mystic'
$repo = 'E:\work\javadude_dev\MysticWeb'
$out = Join-Path $env:TEMP 'mysticgateway-preflight.txt'
$lines = New-Object 'System.Collections.Generic.List[string]'
function Add([string]$s) { [void]$lines.Add($s); Write-Host $s }
function CheckPath([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing: $path" }
  $item = Get-Item -LiteralPath $path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Refusing reparse point: $path" }
  return $item
}
try {
  $r = CheckPath $root
  $p = CheckPath $repo
  if ($r.FullName -ne 'E:\mystic' -or $p.FullName -ne 'E:\work\javadude_dev\MysticWeb') { throw 'Unexpected paths' }
  Add 'MysticGateway read-only preflight'
  Add ('Date UTC: ' + [DateTime]::UtcNow.ToString('u'))
  Add ('Windows: ' + [Environment]::OSVersion.VersionString)
  Add ('PowerShell: ' + $PSVersionTable.PSVersion.ToString())
  foreach ($name in @('mystic.exe','mystic64.exe','mystic.dat','users.dat','docs\records.112')) {
    $path = Join-Path $root $name
    if (Test-Path -LiteralPath $path) {
      $f = CheckPath $path
      Add ("Found $name; bytes=$($f.Length)")
    } else { Add ("Absent $name") }
  }
  foreach ($cmd in @('fpc','go','gcc','git','node')) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    Add ("Tool $cmd : " + $(if ($found) { 'available' } else { 'not found' }))
  }
  Push-Location $repo
  try {
    Add ('Git branch: ' + (git branch --show-current))
    Add ('Git commit: ' + (git rev-parse --short HEAD))
    Add ('Git changes: ' + $(if ((git status --porcelain).Count -eq 0) { 'clean' } else { 'present' }))
  } finally { Pop-Location }
  Add 'Preflight complete. No native code executed and no BBS records read.'
} catch {
  Add ('Preflight stopped: ' + $_.Exception.Message)
} finally {
  $lines | Set-Content -LiteralPath $out -Encoding UTF8
  Write-Host ("Report: " + $out)
  try { Set-Clipboard -Value ($lines -join [Environment]::NewLine) } catch { Write-Host 'Clipboard unavailable; report still saved.' }
}
