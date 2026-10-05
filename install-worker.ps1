$ErrorActionPreference='Stop'
$taskProjectDir=$PSScriptRoot
$taskStartupDir=[Environment]::GetFolderPath('Startup')
$taskShortcutPath=Join-Path $taskStartupDir 'ForgeRadar Worker.lnk'
$taskShell=New-Object -ComObject WScript.Shell
$taskShortcut=$taskShell.CreateShortcut($taskShortcutPath)
$taskShortcut.TargetPath=(Get-Command powershell.exe).Source
$taskShortcut.Arguments='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $taskProjectDir 'worker-supervisor.ps1')+'"'
$taskShortcut.WorkingDirectory=$taskProjectDir
$taskShortcut.WindowStyle=7
$taskShortcut.Description='Keep ForgeRadar local model, engine and dashboard bridge available after sign-in.'
$taskShortcut.Save()
$taskAlreadyRunning=Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains((Join-Path $taskProjectDir 'worker-supervisor.ps1')) -and $_.ProcessId -ne $PID }
if (-not $taskAlreadyRunning) { $taskProcess=Start-Process -FilePath $taskShortcut.TargetPath -ArgumentList $taskShortcut.Arguments -WindowStyle Hidden -WorkingDirectory $taskProjectDir -PassThru; $taskProcess.Id | Set-Content -LiteralPath (Join-Path $taskProjectDir 'data/supervisor.pid') }
Write-Output 'ForgeRadar worker recovery installed for this Windows user. It starts at sign-in and checks services every 30 seconds. Remove ForgeRadar Worker.lnk from the Startup folder to uninstall.'
