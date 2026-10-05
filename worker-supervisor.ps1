$ErrorActionPreference='Continue'
$taskProjectDir=$PSScriptRoot
while ($true) {
    try { & (Join-Path $taskProjectDir 'start.ps1') | Out-Null } catch { Add-Content -LiteralPath (Join-Path $taskProjectDir 'data/supervisor-error.log') -Value ((Get-Date).ToString('o')+' '+$_.Exception.Message) }
    Start-Sleep -Seconds 30
}
