# Read-only JAM snapshot and comparison. PowerShell 5.1+.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateSet('capture','compare')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$true)][string]$Snapshot,
  [string]$After
)
$ErrorActionPreference = 'Stop'
$extensions = @('.jhr','.jdx','.jdt','.jlr','.xlr','.scn')
function Full([string]$p) { return [IO.Path]::GetFullPath($p).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar) }
function IsInside([string]$parent,[string]$child) {
  return $child.StartsWith($parent + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)
}
$rootPath = Full $Root
if (-not (Test-Path -LiteralPath $rootPath -PathType Container)) { throw 'JAM root does not exist.' }
$rootItem = Get-Item -LiteralPath $rootPath -Force
if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'JAM root is a reparse point.' }
$rootResolved = Full $rootItem.FullName
$snapshotPath = Full $Snapshot
if (IsInside $rootResolved $snapshotPath) { throw 'Snapshot must be outside JAM root.' }
if ($Mode -eq 'compare') {
  if (-not (Test-Path -LiteralPath $snapshotPath -PathType Leaf)) { throw 'Baseline snapshot missing.' }
  if ([string]::IsNullOrWhiteSpace($After)) { throw 'Specify -After outside JAM root.' }
  $afterPath = Full $After
  if ((IsInside $rootResolved $afterPath) -or $afterPath -eq $snapshotPath) { throw 'Invalid comparison output path.' }
}
function Inventory {
  $files = @(Get-ChildItem -LiteralPath $rootResolved -File -Recurse -Force | Where-Object {
    $extensions -contains $_.Extension.ToLowerInvariant()
  } | Sort-Object FullName)
  $records = @()
  foreach ($file in $files) {
    if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Refusing reparse-point file.' }
    $relative = $file.FullName.Substring($rootResolved.Length + 1).Replace('\','/')
    $records += [pscustomobject]@{
      path = $relative
      length = [long]$file.Length
      modifiedUtc = $file.LastWriteTimeUtc.ToString('o')
      sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  return ,$records
}
if ($Mode -eq 'capture') {
  if (Test-Path -LiteralPath $snapshotPath) { throw 'Snapshot exists; choose a new filename.' }
  $payload = [pscustomobject]@{
    schema = 1
    root = $rootResolved
    capturedUtc = [DateTime]::UtcNow.ToString('o')
    files = @(Inventory)
  }
  $payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $snapshotPath -Encoding UTF8 -NoNewline
  Write-Host "Captured $($payload.files.Count) JAM-related files to $snapshotPath"
  exit 0
}
$baseline = Get-Content -LiteralPath $snapshotPath -Raw | ConvertFrom-Json
if ($baseline.schema -ne 1 -or (Full ([string]$baseline.root)) -ne $rootResolved) { throw 'Snapshot schema or root mismatch.' }
$current = @(Inventory)
$old = @{}
foreach ($item in @($baseline.files)) { $old[[string]$item.path] = $item }
$new = @{}
foreach ($item in $current) { $new[[string]$item.path] = $item }
$changes = @()
foreach ($name in @((@($old.Keys) + @($new.Keys)) | Sort-Object -Unique)) {
  $before = $old[$name]; $now = $new[$name]
  $status = if ($null -eq $before) { 'added' } elseif ($null -eq $now) { 'removed' } elseif ($before.sha256 -ne $now.sha256) { 'changed' } else { 'unchanged' }
  if ($status -ne 'unchanged') {
    $changes += [pscustomobject]@{ path=$name; status=$status; beforeLength=if($before){$before.length}else{$null}; afterLength=if($now){$now.length}else{$null}; beforeSha256=if($before){$before.sha256}else{$null}; afterSha256=if($now){$now.sha256}else{$null} }
  }
}
$report = [pscustomobject]@{ schema=1; baseline=$snapshotPath; root=$rootResolved; comparedUtc=[DateTime]::UtcNow.ToString('o'); changes=$changes }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $afterPath -Encoding UTF8 -NoNewline
$changes | Format-Table path,status,beforeLength,afterLength -AutoSize
Write-Host "Compared $($current.Count) files; $($changes.Count) changes. Report: $afterPath"
