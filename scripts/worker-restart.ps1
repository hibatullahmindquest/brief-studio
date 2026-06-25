# worker-restart.ps1 - tree-kill any stale brief-studio worker, then start ONE interactive worker.
# Use this instead of killing `npm run worker` directly: on Windows, killing the npm wrapper
# leaves the tsx/node child ALIVE, so two workers can run at once and double-process jobs.
# Run from the repo root:  npm run worker:restart
$ErrorActionPreference = "SilentlyContinue"

Write-Host "Looking for stale brief-studio workers..."
$stale = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'brief-studio' -and $_.CommandLine -match 'src[\\/]worker[\\/]index|worker:interactive|worker:background' }

if ($stale) {
  foreach ($p in $stale) {
    Write-Host ("  killing PID {0}" -f $p.ProcessId)
    taskkill /F /T /PID $p.ProcessId 2>&1 | Out-Null
  }
  Start-Sleep -Milliseconds 500
} else {
  Write-Host "  none found."
}

$left = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'brief-studio' -and $_.CommandLine -match 'src[\\/]worker[\\/]index' }).Count
if ($left -gt 0) { Write-Warning ("{0} worker process(es) still alive - kill manually before continuing." -f $left) }

Write-Host "Starting one interactive worker..."
npm run worker:interactive
