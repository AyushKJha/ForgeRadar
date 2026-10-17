$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$taskData = Join-Path $taskRoot 'data'
$taskProjects = Join-Path $taskRoot 'projects'
$taskStatePath = Join-Path $taskData 'state.json'
$taskPortsPath = Join-Path $taskData 'local-project-ports.json'
if (-not (Test-Path -LiteralPath $taskStatePath)) { Write-Output 'No projects to launch yet.'; return }
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskState = Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
$taskExisting = @{}
if (Test-Path -LiteralPath $taskPortsPath) {
    foreach ($taskItem in @(Get-Content -LiteralPath $taskPortsPath -Raw | ConvertFrom-Json)) { $taskExisting[[string]$taskItem.id] = $taskItem }
}
$taskRecords = @()
$taskReserved = @{}
foreach ($taskProject in @($taskState.projects | Where-Object { $_.buildMode -eq 'fullstack' -and $_.status -eq 'Application ready' -and $_.qa.syntax -eq 'Passed' })) {
    $taskId = [string]$taskProject.id
    if ($taskId -notmatch '^[a-f0-9-]{36}$') { continue }
    $taskFolder = [IO.Path]::GetFullPath((Join-Path $taskProjects $taskId))
    if (-not $taskFolder.StartsWith([IO.Path]::GetFullPath($taskProjects) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { continue }
    $taskServer = Join-Path $taskFolder 'server.mjs'
    if (-not (Test-Path -LiteralPath $taskServer) -or -not (Test-Path -LiteralPath (Join-Path $taskFolder 'app.json'))) { continue }
    $taskPrior = $taskExisting[$taskId]
    $taskPort = if ($taskPrior -and [int]$taskPrior.port -ge 4320 -and [int]$taskPrior.port -le 4399) { [int]$taskPrior.port } else { 0 }
    $taskRunning = $false
    if ($taskPrior -and $taskPort) {
        $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$taskPrior.pid)" -ErrorAction SilentlyContinue
        $taskListener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $taskPort -State Listen -ErrorAction SilentlyContinue
        $taskRunning = [bool]($taskProcess -and $taskProcess.CommandLine.Contains($taskServer) -and $taskListener -and $taskListener.OwningProcess -eq [int]$taskPrior.pid)
    }
    if ($taskRunning) { $taskProjectPid = [int]$taskPrior.pid }
    else {
        if (-not $taskPort -or $taskReserved.ContainsKey($taskPort) -or (Get-NetTCPConnection -LocalPort $taskPort -State Listen -ErrorAction SilentlyContinue)) {
            $taskPort = @(4320..4399 | Where-Object { -not $taskReserved.ContainsKey($_) -and -not (Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue) } | Select-Object -First 1)[0]
        }
        if (-not $taskPort) { Write-Output "No free local port for $($taskProject.title)."; continue }
        $taskOldPort = $env:PORT; $taskOldHost = $env:HOST
        try {
            $env:PORT = [string]$taskPort; $env:HOST = '127.0.0.1'
            $taskProcess = Start-Process -FilePath $taskNode -ArgumentList @('"' + $taskServer + '"') -WorkingDirectory $taskFolder -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskData "$taskId-out.log") -RedirectStandardError (Join-Path $taskData "$taskId-error.log")
            $taskProjectPid = $taskProcess.Id
        } finally { $env:PORT = $taskOldPort; $env:HOST = $taskOldHost }
    }
    $taskReserved[$taskPort] = $true
    $taskRecords += [pscustomobject]@{ id = $taskId; title = [string]$taskProject.title; port = $taskPort; pid = $taskProjectPid; url = "http://127.0.0.1:$taskPort/" }
    Write-Output "$($taskProject.title): http://127.0.0.1:$taskPort/"
}
$taskRecords | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $taskPortsPath -Encoding utf8
