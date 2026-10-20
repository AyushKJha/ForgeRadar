param([switch]$NoModel)
$ErrorActionPreference = 'Stop'
$taskProjectDir = $PSScriptRoot
$taskRuntimeDir = [IO.Path]::GetFullPath((Join-Path $taskProjectDir '../../work/ollama'))
$taskLogDir = Join-Path $taskProjectDir 'data'
New-Item -ItemType Directory -Force -Path $taskLogDir | Out-Null
function Save-OptionalProcessId([int]$ProcessId, [string]$Path) {
    try { $ProcessId | Set-Content -LiteralPath $Path -ErrorAction Stop }
    catch { Write-Warning "Could not save optional process tracking file '$Path'; the service will remain managed by its health endpoint. $($_.Exception.Message)" }
}
function Test-LocalListener([int]$Port) {
    try { return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1) }
    catch { return $false }
}
$taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$taskNodeExe = if ($taskNodeCommand) { $taskNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $taskNodeExe)) { throw 'Node.js was not found. Install Node.js or repair the bundled ForgeRadar runtime.' }
$taskPrivateAccessFile = Join-Path $taskLogDir 'private-access.json'
if (Test-Path -LiteralPath $taskPrivateAccessFile) {
    $taskPrivateAccess = Get-Content -LiteralPath $taskPrivateAccessFile -Raw | ConvertFrom-Json
    $taskTailnetHost = [string]$taskPrivateAccess.host
    if ($taskTailnetHost -notmatch '^[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})+\.ts\.net$') { throw 'Invalid saved Tailscale hostname' }
    $env:FORGERADAR_TAILSCALE_HOST = $taskTailnetHost
}
$taskLocalTokenFile = Join-Path $taskLogDir 'local-service-token.json'
$taskHeaders = @{}
$taskBundledPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
if (-not $env:FORGERADAR_PYTHON -and (Test-Path -LiteralPath $taskBundledPython)) { $env:FORGERADAR_PYTHON = $taskBundledPython }
if (Test-Path -LiteralPath $taskLocalTokenFile) {
    $taskLocalToken = (Get-Content -LiteralPath $taskLocalTokenFile -Raw | ConvertFrom-Json).token
    $taskHeaders.Authorization = 'Bearer ' + $taskLocalToken
}
if (-not $NoModel) {
    $taskOllamaReady = $false
    try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2; $taskOllamaReady = $true } catch {}
    if (-not $taskOllamaReady) {
        if (Test-LocalListener 11434) { throw 'Port 11434 is already occupied, but Ollama health checks fail. Reuse or stop the service that owns this port before starting ForgeRadar.' }
        $taskOllamaExe = Join-Path $taskRuntimeDir 'ollama.exe'
        if (-not (Test-Path -LiteralPath $taskOllamaExe)) {
            $taskOllamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
            if ($taskOllamaCommand) { $taskOllamaExe = $taskOllamaCommand.Source }
        }
        if (Test-Path -LiteralPath $taskOllamaExe) {
            $env:OLLAMA_HOST = '127.0.0.1:11434'
            $env:OLLAMA_NO_CLOUD = '1'
            $env:OLLAMA_NUM_PARALLEL = '1'
            $env:OLLAMA_MAX_LOADED_MODELS = '1'
            if (Test-Path -LiteralPath (Join-Path $taskRuntimeDir 'models')) { $env:OLLAMA_MODELS = Join-Path $taskRuntimeDir 'models' }
            $taskOllamaProcess = Start-Process -FilePath $taskOllamaExe -ArgumentList 'serve' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogDir 'ollama.log') -RedirectStandardError (Join-Path $taskLogDir 'ollama-error.log')
            Save-OptionalProcessId $taskOllamaProcess.Id (Join-Path $taskLogDir 'ollama.pid')
        } else { Write-Output 'Ollama is not installed. Discovery collection is available; model stages will wait.' }
    }
}
$taskEngineReady = $false
try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/api/machine' -Headers $taskHeaders -TimeoutSec 2; $taskEngineReady = $true } catch {}
if (-not $taskEngineReady) {
    if (Test-LocalListener 4317) { throw 'Port 4317 is already occupied, but the ForgeRadar health endpoint did not respond. The existing service was left untouched; check its logs and authentication token.' }
    $taskServerFile = Join-Path $taskProjectDir 'server.mjs'
    $taskEngineProcess = Start-Process -FilePath $taskNodeExe -ArgumentList @('"' + $taskServerFile + '"') -WorkingDirectory $taskProjectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogDir 'engine.log') -RedirectStandardError (Join-Path $taskLogDir 'engine-error.log')
    Save-OptionalProcessId $taskEngineProcess.Id (Join-Path $taskLogDir 'engine.pid')
}
$taskServicesReady = $false
for ($taskWait=0; $taskWait -lt 30; $taskWait++) {
    try {
        if (-not $taskHeaders.Authorization -and (Test-Path -LiteralPath $taskLocalTokenFile)) {
            $taskLocalToken = (Get-Content -LiteralPath $taskLocalTokenFile -Raw | ConvertFrom-Json).token
            $taskHeaders.Authorization = 'Bearer ' + $taskLocalToken
        }
        $null=Invoke-RestMethod 'http://127.0.0.1:4317/api/machine' -Headers $taskHeaders -TimeoutSec 2
        if (-not $NoModel) { $null=Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 }
        $taskServicesReady = $true
        break
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $taskServicesReady) { throw 'ForgeRadar services did not pass their health checks within 30 seconds. See data/engine-error.log and data/ollama-error.log.' }
& (Join-Path $taskProjectDir 'secure-private.ps1')
& (Join-Path $taskProjectDir 'start-projects.ps1')
$taskDeploymentFile=Join-Path $taskLogDir 'deployment.json'
if ((Test-Path -LiteralPath $taskDeploymentFile) -and (Get-Content -LiteralPath $taskDeploymentFile -Raw|ConvertFrom-Json).url) {
    $taskBridgeRunning=$false
    $taskBridgePidFile=Join-Path $taskLogDir 'bridge.pid'
    if (Test-Path -LiteralPath $taskBridgePidFile) {
        $taskBridgePid=[int](Get-Content -LiteralPath $taskBridgePidFile)
        $taskBridgeProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $taskBridgePid" -ErrorAction SilentlyContinue
        $taskBridgeRunning=$taskBridgeProcess -and $taskBridgeProcess.CommandLine.Contains((Join-Path $taskProjectDir 'bridge.mjs'))
    }
    if (-not $taskBridgeRunning) {
        $taskBridge=Start-Process -FilePath $taskNodeExe -ArgumentList @('"'+(Join-Path $taskProjectDir 'bridge.mjs')+'"') -WorkingDirectory $taskProjectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogDir 'bridge.log') -RedirectStandardError (Join-Path $taskLogDir 'bridge-error.log')
        Save-OptionalProcessId $taskBridge.Id $taskBridgePidFile
    }
}
Write-Output 'ForgeRadar local services launched. Open http://127.0.0.1:4317.'
