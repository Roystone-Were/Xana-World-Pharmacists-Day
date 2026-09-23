# Snapshots every walk registration to CSV/JSON, for extraction at any later
# date. Meant to run on a schedule: Mailgun keeps a notice's subject for ~5 days
# but its body (phone, email, T-shirt) for 24h, so a regular run is what makes
# the details survive past that window.
#
# Sources, merged by reference:
#   - Mailgun events log (needs the private API key: -KeyFile or MG_API_KEY)
#   - the local Outlook profile (best effort; skipped when Outlook is unavailable)
#
# Usage:
#   .\tools\refresh-records.ps1 -OutDir "$env:USERPROFILE\Personal\Xana-Walk" `
#        -KeyFile "$env:USERPROFILE\Personal\_Garage\Mailgun-Xana.txt"
# Schedule it with Task Scheduler (see README section 10).

param(
  [string]$OutDir = "$env:USERPROFILE\Personal\Xana-Walk",
  [string]$KeyFile = "",
  [string]$Domain = "xana.afyanalytics.net"
)

$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$log = Join-Path $OutDir "refresh.log"

# Mailgun key: -KeyFile first, then MG_API_KEY.
$key = ""
if ($KeyFile -and (Test-Path $KeyFile)) {
  $line = Select-String -Path $KeyFile -Pattern '^MAILGUN_SECRET=' | Select-Object -First 1
  if ($line) { $key = ($line.Line -replace '^MAILGUN_SECRET=', '').Trim() }
}
if (-not $key) { $key = [string]$env:MG_API_KEY }
if (-not $key) {
  "$(Get-Date -Format s)  no Mailgun key (-KeyFile or MG_API_KEY): mailbox snapshot only" | Add-Content -Path $log
}

# Mailbox dump, best effort: a closed or stale Outlook must not break the run.
$dump = Join-Path $env:TEMP "xana-outlook-dump.json"
$extra = @()
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo "tools\outlook-export.ps1") -OutFile $dump | Out-Null
  if (Test-Path $dump) { $extra = @("--outlook", $dump) }
} catch { }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  "$(Get-Date -Format s)  node not on PATH: snapshot skipped" | Add-Content -Path $log
  exit 1
}

$env:MG_API_KEY = $key
$env:MG_DOMAIN = $Domain
$out = & $node (Join-Path $repo "tools\extract-registrations.mjs") --out $OutDir --since 26 @extra 2>&1
$summary = (($out | Where-Object { $_ -match "notices|registrations|unique references|with phone|with email|with size" }) -join " | ")
"$(Get-Date -Format s)  $summary" | Add-Content -Path $log
$summary
