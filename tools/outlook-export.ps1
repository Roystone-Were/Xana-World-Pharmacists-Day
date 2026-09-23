# Dumps every registration notice from the local Outlook profile to JSON, for
# tools/extract-registrations.mjs. Read-only: opens Outlook via COM and only
# reads message properties, never sends, moves or deletes anything.
#
# Permanent source of truth: unlike the Mailgun log (5 days) and the Mailgun
# message bodies (24h), mailboxes keep the full record - name, phone, email,
# T-shirt size, reference - for as long as the mail exists.
#
# Usage (PowerShell):
#   .\tools\outlook-export.ps1 -OutFile "$env:TEMP\xana-outlook.json"
# Add the second organizer mailbox to the Outlook profile first if its notices
# are not cached here; every store in the profile is scanned.

param(
  [string]$OutFile = "$env:TEMP\xana-outlook.json"
)

$ErrorActionPreference = "Continue"
$ol = New-Object -ComObject Outlook.Application
$ns = $ol.GetNamespace("MAPI")

$results = New-Object System.Collections.ArrayList
$folders = 0

function Walk($folder, $path) {
  $full = if ($path) { "$path\$($folder.Name)" } else { $folder.Name }
  $script:folders++
  $count = -1
  try { $count = $folder.Items.Count } catch { $count = -1 }
  if ($count -gt 0) {
    $items = $null
    try { $items = $folder.Items } catch { $items = $null }
    if ($null -ne $items) {
      foreach ($it in $items) {
        $subj = ""
        try { $subj = [string]$it.Subject } catch { $subj = "" }
        if ($subj -match "(?i)walker registered|new registration|pharmacist|walker") {
          $body = ""; $rec = ""; $snd = ""; $sndn = ""; $to = ""
          try { $body = [string]$it.Body } catch { $body = "" }
          try { $rec = $it.ReceivedTime.ToString("o") } catch { $rec = "" }
          try { $snd = [string]$it.SenderEmailAddress } catch { $snd = "" }
          try { $sndn = [string]$it.SenderName } catch { $sndn = "" }
          try { $to = [string]$it.To } catch { $to = "" }
          if ($body.Length -gt 9000) { $body = $body.Substring(0, 9000) }
          [void]$results.Add([pscustomobject]@{
            folder = $full; subject = $subj; received = $rec;
            sender = $snd; senderName = $sndn; to = $to; body = $body
          })
        }
      }
    }
  }
  $subs = $null
  try { $subs = $folder.Folders } catch { $subs = $null }
  if ($null -ne $subs) { foreach ($sub in $subs) { Walk $sub $full } }
}

foreach ($top in $ns.Folders) { Walk $top "" }

$dir = Split-Path -Parent $OutFile
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$results | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $OutFile

$regs = @($results | Where-Object { $_.subject -match "(?i)walker registered|new registration" })
"folders scanned: $folders"
"matched messages: $($results.Count) | registrations: $($regs.Count)"
"written: $OutFile"
