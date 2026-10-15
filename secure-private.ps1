$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$taskData = [IO.Path]::GetFullPath((Join-Path $taskRoot 'data'))
$taskTemp = [IO.Path]::GetFullPath((Join-Path $taskData 'private-temp'))
$taskProjects = [IO.Path]::GetFullPath((Join-Path $taskRoot 'projects'))
if (-not $taskTemp.StartsWith($taskData + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    -not $taskData.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    -not $taskProjects.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Private path escaped the ForgeRadar data directory'
}
New-Item -ItemType Directory -Force -Path $taskTemp | Out-Null
$taskSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$taskDirectoryGrants = @("*${taskSid}:(OI)(CI)(F)", '*S-1-5-18:(OI)(CI)(F)', '*S-1-5-32-544:(OI)(CI)(F)')
$taskFileGrants = @("*${taskSid}:(F)", '*S-1-5-18:(F)', '*S-1-5-32-544:(F)')
foreach ($taskPath in @($taskData, $taskProjects)) {
    if (-not (Test-Path -LiteralPath $taskPath)) { continue }
    $taskItems = @(Get-Item -LiteralPath $taskPath) + @(Get-ChildItem -LiteralPath $taskPath -Recurse -Force)
    foreach ($taskItem in $taskItems) {
        $taskResolved = [IO.Path]::GetFullPath($taskItem.FullName)
        if ($taskResolved -ne $taskPath -and -not $taskResolved.StartsWith($taskPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Private item escaped its expected directory' }
        if ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Private directory contains a junction or symbolic link' }
        $taskGrants = if ($taskItem.PSIsContainer) { $taskDirectoryGrants } else { $taskFileGrants }
        & icacls.exe $taskResolved /inheritance:r /grant:r $taskGrants | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not restrict private item permissions: $taskResolved" }
    }
}
