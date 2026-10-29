$ErrorActionPreference = 'Stop'
$sandboxRoot = [IO.Path]::GetFullPath('E:\mystic').TrimEnd('\')
$held = New-Object 'System.Collections.Generic.List[System.IO.FileStream]'

function Assert-SandboxPath([string]$candidate) {
  $full = [IO.Path]::GetFullPath($candidate)
  if (($full -ne $sandboxRoot) -and -not $full.StartsWith($sandboxRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Outside sandbox' }
  $current = $full
  while ($current) {
    $item = Get-Item -LiteralPath $current -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked component' }
    $parent = [IO.Directory]::GetParent($current)
    if ($null -eq $parent) { break }
    $current = $parent.FullName
  }
  return $full
}

try {
  $catalogPath = Assert-SandboxPath (Join-Path $sandboxRoot 'data\mbases.dat')
  $catalog = [IO.File]::ReadAllBytes($catalogPath)
  if (($catalog.Length % 768) -ne 0 -or $catalog.Length -gt (512 * 768)) { throw 'Unsupported catalog' }
  $paths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  for ($offset = 0; $offset -lt $catalog.Length; $offset += 768) {
    $flags = [BitConverter]::ToUInt32($catalog, $offset + 577)
    $privateBase = (($flags -band 16) -ne 0 -or $catalog[$offset + 260] -eq 3)
    $fileLength = $catalog[$offset + 138]
    $pathLength = $catalog[$offset + 179]
    if ($fileLength -lt 1 -or $fileLength -gt 40 -or $pathLength -gt 80) { throw 'Unsupported field' }
    $name = [Text.Encoding]::GetEncoding(28591).GetString($catalog, $offset + 139, $fileLength)
    $folder = [Text.Encoding]::GetEncoding(28591).GetString($catalog, $offset + 180, $pathLength)
    if ($name -match '[\\/:]' -or $name.Contains('..')) { throw 'Unsupported base name' }
    if (-not [IO.Path]::IsPathRooted($folder)) { $folder = Join-Path $sandboxRoot $folder }
    [void](Assert-SandboxPath $folder)
    foreach ($extension in @('jhr', 'jdt', 'jdx', 'jlr')) {
      $candidate = Join-Path $folder ($name + '.' + $extension)
      # Empty private bases may have no last-read file. Protect every existing
      # private file too; do not create absent files merely for verification.
      if ($privateBase -and $extension -eq 'jlr' -and -not (Test-Path -LiteralPath $candidate)) { continue }
      $file = Assert-SandboxPath $candidate
      if (-not $paths.Add($file)) { continue }
      # Existing native write/delete handles conflict. No weaker sharing fallback.
      $stream = New-Object IO.FileStream($file, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
      $held.Add($stream)
    }
  }
  if ($held.Count -eq 0) { throw 'No public fixture files' }
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $digest = ([BitConverter]::ToString($sha.ComputeHash($catalog))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
  [Console]::Out.WriteLine('MESSAGE_LOCKS_READY ' + $held.Count + ' ' + $digest)
  [Console]::Out.Flush()
  [void][Console]::In.ReadLine()
} catch {
  [Console]::Out.WriteLine('MESSAGE_LOCKS_UNAVAILABLE')
  exit 1
} finally {
  foreach ($stream in $held) { $stream.Dispose() }
}
