# Mystic Event Scheduler -> MysticWeb HTTPS maintenance endpoint.
# Token lives in the private Mystic data/mysticweb directory, not the command line.
param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$TokenFile = ""
)
$ErrorActionPreference = "Stop"
try {
  if ([string]::IsNullOrWhiteSpace($TokenFile)) {
    $root = [Environment]::GetEnvironmentVariable("MYSTIC_DATA_ROOT")
    if ([string]::IsNullOrWhiteSpace($root)) { $root = "C:\MysticSandbox" }
    $TokenFile = Join-Path (Join-Path (Join-Path $root "data") "mysticweb") "mysticweb-api.json"
  }
  $file = Get-Item -LiteralPath $TokenFile -ErrorAction Stop
  if ($file.PSIsContainer -or $file.Length -gt 1024) { throw "Invalid API token file" }
  $credential = Get-Content -LiteralPath $TokenFile -Raw | ConvertFrom-Json
  if ($credential.version -ne 1 -or $credential.token -cnotmatch '^[a-f0-9]{64}$') {
    throw "Invalid API token format"
  }
  $uri = $BaseUrl.TrimEnd('/') + "/api/internal/maintenance/message-bases"
  $target = [Uri]$uri
  if ($target.Scheme -ne 'https' -and $target.Host -notin @('127.0.0.1', 'localhost', '::1')) {
    throw "Remote maintenance requests require HTTPS"
  }
  $result = Invoke-RestMethod -Method Post -Uri $uri -Headers @{
    Authorization = "Bearer $($credential.token)"
  } -TimeoutSec 60
  $result | ConvertTo-Json -Depth 8
} catch {
  Write-Error "MysticWeb message-base refresh failed: $_"
  exit 1
}
