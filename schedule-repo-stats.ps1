# Installs (or removes) a weekly Windows task that records GitHub's clone counts for Orient's repositories.
# GitHub keeps only 14 days of traffic, so something has to collect it regularly. See repo-stats.cjs.
#
#   .\schedule-repo-stats.ps1                         install: Sundays at 09:00
#   .\schedule-repo-stats.ps1 -Day Friday -At 18:30   another time
#   .\schedule-repo-stats.ps1 -Remove                 take it away again
#
# The task runs as you, only while you are signed in (it needs the GitHub login that git has stored), with no
# window, and runs at the next opportunity if the computer was off at the scheduled time. Each run's output
# replaces data\repo-stats-last-run.txt, so you can see whether it worked.
param(
  [switch]$Remove,
  [ValidateSet('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')][string]$Day = 'Sunday',
  [string]$At = '09:00'
)
$ErrorActionPreference = 'Stop'
$name = 'Orient repo stats'

if ($Remove) {
  if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    "Removed the task '$name'."
  } else { "There is no task called '$name'." }
  return
}

$root = $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$data = Join-Path $root 'data'
New-Item -ItemType Directory -Force $data | Out-Null
$log = Join-Path $data 'repo-stats-last-run.txt'

# A hidden PowerShell runs the script and keeps its output (a plain console app would flash a window)
$command = "Set-Location -LiteralPath '$root'; & '$node' repo-stats.cjs 2>&1 | Out-File -Encoding utf8 -FilePath '$log'"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -Command "' + $command + '"') -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Day -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force `
  -Description "Records GitHub clone counts for Orient's repositories (repo-stats.cjs) so history outlasts GitHub's 14 days." | Out-Null

$info = Get-ScheduledTask -TaskName $name | Get-ScheduledTaskInfo
"Installed '$name': every $Day at $At. Next run: $($info.NextRunTime)."
"Output of the latest run: $log"
"Remove it with: .\schedule-repo-stats.ps1 -Remove"
