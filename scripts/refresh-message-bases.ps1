# Invoke from Mystic Event Scheduler as an external command, or from
# a Windows scheduled task following nightly MUTIL maintenance.
# Requires MYSTICWEB_MAINTENANCE_TOKEN (at least 32 characters) in the
# scheduled process environment. Do not put the token in Mystic's command line.
param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)
$ErrorActionPreference = "Stop"
$token = [Environment]::GetEnvironmentVariable("MYSTICWEB_MAINTENANCE_TOKEN")
if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -lt 32) {
  throw "MYSTICWEB_MAINTENANCE_TOKEN is missing or too short"
}
$uri = $BaseUrl.TrimEnd('/') + "/api/internal/maintenance/message-bases"
try {
  $result = Invoke-RestMethod -Method Post -Uri $uri -Headers @{
    Authorization = "Bearer $token"
  } -TimeoutSec 60
  $result | ConvertTo-Json -Depth 8
} catch {
  Write-Error "MysticWeb message-base refresh failed: $_"
  exit 1
}
