$ErrorActionPreference = 'Stop'
$launcherPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'lets-cook.mjs'))
if (-not (Test-Path -LiteralPath $launcherPath)) { throw 'Project launcher is missing.' }
$escapedLauncher = $launcherPath.Replace("'", "''")
$profileBlock = @"
# BEGIN Riftbound lets cook
function lets {
    param([string]`$Action)
    if (`$Action -ne 'cook') { throw 'Usage: lets cook' }
    & node '$escapedLauncher'
}
# END Riftbound lets cook
"@
$documentsPath = [Environment]::GetFolderPath('MyDocuments')
$profilePaths = @(
    [string]$PROFILE.CurrentUserCurrentHost
    (Join-Path $documentsPath 'PowerShell\Microsoft.PowerShell_profile.ps1')
) | Select-Object -Unique
foreach ($profilePath in $profilePaths) {
    $existingText = if (Test-Path -LiteralPath $profilePath) { [System.IO.File]::ReadAllText($profilePath) } else { '' }
    $markerPattern = '(?ms)^# BEGIN Riftbound lets cook\r?\n.*?^# END Riftbound lets cook\r?\n?'
    if ($existingText -match $markerPattern) {
        $updatedText = [regex]::Replace($existingText, $markerPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $profileBlock + "`r`n" })
    } else {
        if ($existingText -match '(?im)^\s*function\s+lets\b') { throw "A lets function already exists in $profilePath; it was not overwritten." }
        $updatedText = $existingText.TrimEnd() + "`r`n`r`n" + $profileBlock + "`r`n"
    }
    $profileDirectory = Split-Path -Parent $profilePath
    [System.IO.Directory]::CreateDirectory($profileDirectory) | Out-Null
    [System.IO.File]::WriteAllText($profilePath, $updatedText, [System.Text.UTF8Encoding]::new($true))
    Write-Output "Installed lets cook in $profilePath"
}
Write-Output 'Open a new PowerShell terminal, then type: lets cook'
