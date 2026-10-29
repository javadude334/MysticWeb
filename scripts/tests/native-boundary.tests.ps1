param([Parameter(Mandatory=$true)][string]$Compiler)
$ErrorActionPreference = 'Stop'
# Run a COPIED checkout below E:\mystic. Never replace the installed gateway.
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $root.StartsWith('E:\mystic\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Sandbox copy required' }
. ([scriptblock]::Create(([Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'scripts\gateway-preflight.ps1'), [ref]$null, [ref]$null)).Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'CheckPath'}, $true).Extent.Text))
$null = CheckPath $root
$output = Join-Path $root ('native-validation-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $output
foreach ($program in @('BoundaryProbe','MysticGateway')) {
    & $Compiler "-Fu$(Join-Path $root 'gateway')" "-FU$output" "-FE$output" (Join-Path $root "gateway\$program.pas")
    if ($LASTEXITCODE -ne 0) { throw "Compilation failed: $program" }
}
$probe = Join-Path $output 'BoundaryProbe.exe'
$plain = New-Item -ItemType File -Path (Join-Path $output 'empty.txt')
& $probe $plain.FullName
if ($LASTEXITCODE -ne 0) { throw 'Ordinary pinned file failed' }
$junction = Join-Path $output 'junction'
$null = New-Item -ItemType Junction -Path $junction -Target $output
foreach ($candidate in @($junction, (Join-Path $junction 'empty.txt'), (Join-Path $junction 'absent.txt'), (Join-Path $output 'absent.txt'))) {
    & $probe $candidate
    if ($LASTEXITCODE -ne 4) { throw 'Expected path denial' }
}
& (Join-Path $output 'MysticGateway.exe') --authenticate
if ($LASTEXITCODE -ne 11) { throw 'Authentication must remain denied' }
& (Join-Path $output 'MysticGateway.exe') --preflight
if ($LASTEXITCODE -ne 3) { throw 'Nested executable must be denied' }
Write-Output "PASS: native synthetic boundary checks. Retained at $output"

# Expected denial exit codes above are assertions, not the suite's exit status.
exit 0
