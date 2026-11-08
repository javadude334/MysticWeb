# Mystic Event Scheduler -> MysticWeb HTTPS maintenance endpoint.
# Token lives in the private Mystic data/mysticweb directory, not the command line.
param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$TokenFile = "",
  [string]$LogFile = ""
)
$ErrorActionPreference = "Stop"

function Write-MaintenanceLog([string]$Level, [string]$Message) {
  $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
  try {
    $folder = Split-Path -Parent $LogFile
    if ($folder -and -not (Test-Path -LiteralPath $folder)) {
      New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
  } catch {
    # Logging failure must not prevent valid message bases from refreshing.
    Write-Warning "Could not write MysticWeb maintenance log: $($_.Exception.Message)"
  }
}

if ([string]::IsNullOrWhiteSpace($LogFile)) {
  $LogFile = Join-Path (Join-Path $PSScriptRoot "..") "logs\mysticweb-message-base-maintenance.log"
}

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

  $counts = $result.counts
  $skipped = @($result.skipped | Where-Object { $null -ne $_ })
  if ($result.updated -ne $true -or $null -eq $counts -or $null -eq $counts.skipped) {
    throw "Unexpected message-base refresh response"
  }
  foreach ($area in $skipped) {
    $areaId = if ($null -ne $area.areaId) { [string]$area.areaId } else { "unknown" }
    $reason = if ($null -ne $area.reason) { [string]$area.reason } else { "unspecified" }
    # Keep each log entry on one line, even if a remote diagnostic contains newlines.
    $reason = $reason -replace '[\r\n]+', ' '
    Write-MaintenanceLog "WARN" "Area $areaId skipped: $reason"
  }
  $verified = [int]$counts.local + [int]$counts.netmail + [int]$counts.echomail
  if ([int]$counts.skipped -ne $skipped.Count) {
    Write-MaintenanceLog "WARN" "Skipped count mismatch: reported $($counts.skipped), listed $($skipped.Count)"
  }
  $status = if ([int]$counts.skipped -gt 0) { "completed with warnings" } else { "completed" }
  Write-MaintenanceLog "INFO" "Message-base refresh $status. Verified=$verified; skipped=$($counts.skipped)"
  $result | ConvertTo-Json -Depth 8
} catch {
  Write-MaintenanceLog "ERROR" "MysticWeb message-base refresh failed: $($_.Exception.Message)"
  Write-Error "MysticWeb message-base refresh failed: $_"
  exit 1
}
