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
$taskBaseGrants = @("*${taskSid}:(OI)(CI)(F)", '*S-1-5-18:(OI)(CI)(F)', '*S-1-5-32-544:(OI)(CI)(F)')
foreach ($taskPath in @($taskData, $taskProjects)) {
    if (-not (Test-Path -LiteralPath $taskPath)) { continue }
    $taskItems = @(Get-Item -LiteralPath $taskPath) + @(Get-ChildItem -LiteralPath $taskPath -Recurse -Force)
    foreach ($taskItem in $taskItems) {
        $taskResolved = [IO.Path]::GetFullPath($taskItem.FullName)
        if ($taskResolved -ne $taskPath -and -not $taskResolved.StartsWith($taskPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Private item escaped its expected directory' }
        if ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Private directory contains a junction or symbolic link' }
    }
    # Preserve the directory owner as a runtime principal: ForgeRadar may be
    # launched by the Windows offline worker identity instead of the console user.
    $taskOwner = (Get-Acl -LiteralPath $taskPath).Owner
    try { $taskOwnerSid = ([Security.Principal.NTAccount]$taskOwner).Translate([Security.Principal.SecurityIdentifier]).Value }
    catch { throw "Could not resolve the owner of private directory: $taskPath" }
    $taskGrants = @($taskBaseGrants)
    if ($taskOwnerSid -ne $taskSid -and $taskOwnerSid -ne 'S-1-5-18' -and $taskOwnerSid -ne 'S-1-5-32-544') {
        $taskGrants += "*${taskOwnerSid}:(OI)(CI)(F)"
    }

    # Protect the root, then reset only its children so they inherit these
    # restricted grants. This is two recursive ACL operations per tree, instead
    # of spawning icacls once for every file; /reset on `root\*` leaves root intact.
    & icacls.exe $taskPath /inheritance:r /grant:r $taskGrants /C /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not restrict private directory: $taskPath" }
    & icacls.exe (Join-Path $taskPath '*') /reset /T /C /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not apply inherited private permissions under: $taskPath" }
}
