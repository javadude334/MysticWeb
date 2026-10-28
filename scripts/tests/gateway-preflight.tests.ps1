# Run only from a disposable directory below E:\mystic. No native executable runs.
$ErrorActionPreference = 'Stop'
$here = [IO.Path]::GetFullPath($PSScriptRoot)
if (-not $here.StartsWith('E:\mystic\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Tests must run below E:\mystic' }
$source = Join-Path (Split-Path -Parent $PSScriptRoot) 'gateway-preflight.ps1'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Preflight syntax errors' }
$definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'CheckPath' }, $true)
if ($null -eq $definition) { throw 'Missing path guard' }
. ([scriptblock]::Create($definition.Extent.Text))
# Validate the sandbox ancestors before creating any fixtures.
$null = CheckPath $here
$fixture = Join-Path $here ('fixture-' + [guid]::NewGuid().ToString('N'))
$target = New-Item -ItemType Directory -Path (Join-Path $fixture 'target')
$plain = New-Item -ItemType File -Path (Join-Path $target.FullName 'empty.txt')
if ((CheckPath $plain.FullName).Length -ne 0) { throw 'Regular file check failed' }
if ($null -ne (CheckPath (Join-Path $target.FullName 'absent.txt') -Optional)) { throw 'Optional missing check failed' }
$denied = $false
try { $null = CheckPath (Join-Path $target.FullName 'absent.txt') } catch { $denied = $true }
if (-not $denied) { throw 'Required missing file was accepted' }
$link = Join-Path $fixture 'junction'
$null = New-Item -ItemType Junction -Path $link -Target $target.FullName
foreach ($candidate in @($link, (Join-Path $link 'empty.txt'), (Join-Path $link 'absent.txt'))) {
  $denied = $false
  try { $null = CheckPath $candidate -Optional } catch {
    if ($_.Exception.Message -notlike 'Refusing reparse point:*') { throw }
    $denied = $true
  }
  if (-not $denied) { throw 'Reparse traversal was accepted' }
}
Write-Output 'PASS: regular file, optional absence, required absence, junction, intermediate junction, missing child under junction.'
Write-Output "Fixtures retained inside sandbox: $fixture"
