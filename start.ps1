param([switch]$NoModel)
$ErrorActionPreference = 'Stop'
$taskProjectDir = $PSScriptRoot
$taskRuntimeDir = [IO.Path]::GetFullPath((Join-Path $taskProjectDir '../../work/ollama'))
$taskLogDir = Join-Path $taskProjectDir 'data'
New-Item -ItemType Directory -Force -Path $taskLogDir | Out-Null
if (-not $NoModel) {
    $taskOllamaReady = $false
    try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2; $taskOllamaReady = $true } catch {}
    if (-not $taskOllamaReady) {
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
            $taskOllamaProcess.Id | Set-Content -LiteralPath (Join-Path $taskLogDir 'ollama.pid')
        } else { Write-Output 'Ollama is not installed. Discovery collection is available; model stages will wait.' }
    }
}
$taskEngineReady = $false
try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/api/machine' -TimeoutSec 2; $taskEngineReady = $true } catch {}
if (-not $taskEngineReady) {
    $taskNodeExe = (Get-Command node -ErrorAction Stop).Source
    $taskServerFile = Join-Path $taskProjectDir 'server.mjs'
    $taskEngineProcess = Start-Process -FilePath $taskNodeExe -ArgumentList @('"' + $taskServerFile + '"') -WorkingDirectory $taskProjectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogDir 'engine.log') -RedirectStandardError (Join-Path $taskLogDir 'engine-error.log')
    $taskEngineProcess.Id | Set-Content -LiteralPath (Join-Path $taskLogDir 'engine.pid')
}
for ($taskWait=0; $taskWait -lt 45; $taskWait++) {
    try {
        $null=Invoke-RestMethod 'http://127.0.0.1:4317/api/machine' -TimeoutSec 2
        if (-not $NoModel) { $null=Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 }
        break
    } catch { Start-Sleep -Seconds 1 }
}
$taskDeploymentFile=Join-Path $taskLogDir 'deployment.json'
if (Test-Path -LiteralPath $taskDeploymentFile) {
    $taskBridgeRunning=$false
    $taskBridgePidFile=Join-Path $taskLogDir 'bridge.pid'
    if (Test-Path -LiteralPath $taskBridgePidFile) {
        $taskBridgePid=[int](Get-Content -LiteralPath $taskBridgePidFile)
        $taskBridgeProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $taskBridgePid" -ErrorAction SilentlyContinue
        $taskBridgeRunning=$taskBridgeProcess -and $taskBridgeProcess.CommandLine.Contains((Join-Path $taskProjectDir 'bridge.mjs'))
    }
    if (-not $taskBridgeRunning) {
        $taskBridge=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"'+(Join-Path $taskProjectDir 'bridge.mjs')+'"') -WorkingDirectory $taskProjectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogDir 'bridge.log') -RedirectStandardError (Join-Path $taskLogDir 'bridge-error.log')
        $taskBridge.Id | Set-Content -LiteralPath $taskBridgePidFile
    }
}
Write-Output 'ForgeRadar local services launched. Open http://127.0.0.1:4317.'
