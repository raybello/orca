# Removes an Orca install created by install-orca-windows.ps1 (Windows).
# Asks before deleting anything, and defaults to keeping your data and the source checkout.
# Run it from a checkout, or straight from GitHub:
#   powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/raybello/orca/main/config/installers/uninstall-orca-windows.ps1 -OutFile $env:TEMP\uninstall-orca.ps1; & $env:TEMP\uninstall-orca.ps1"
[CmdletBinding()]
param(
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$SourceDir = if ($env:ORCA_SOURCE_DIR) { $env:ORCA_SOURCE_DIR } else { Join-Path $env:USERPROFILE 'Orca' }
$OrcaHome = if ($env:ORCA_BUILD_HOME) { $env:ORCA_BUILD_HOME } else { Join-Path $env:LOCALAPPDATA 'OrcaBuild' }
# Electron's userData/updater-cache folder names come from package.json's "name" ("orca"),
# not the "Orca" productName used for the installer and shortcuts.
$UserDataDir = Join-Path $env:APPDATA 'orca'
$UpdaterCacheDir = Join-Path $env:APPDATA 'orca-updater'
$AppId = 'com.stablyai.orca'

function Say($Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Ok($Message) { Write-Host "  [ok] $Message" -ForegroundColor Green }
function Warn($Message) { Write-Host "  [!] $Message" -ForegroundColor Yellow }
function SkipStep($Message) { Write-Host "  - $Message" }

# Returns $true for yes. $Default is the answer when input is empty ('y' or 'n').
function Confirm-Step($Question, [string]$Default = 'y') {
  if ($Yes) { return $true }
  $prompt = if ($Default -eq 'y') { '[Y/n]' } else { '[y/N]' }
  $reply = Read-Host "  $Question $prompt"
  if ([string]::IsNullOrWhiteSpace($reply)) { $reply = $Default }
  return $reply -match '^(y|yes)$'
}

function Find-Uninstaller {
  # electron-builder's default per-user NSIS layout.
  $direct = Join-Path $env:LOCALAPPDATA 'Programs\Orca\Uninstall Orca.exe'
  if (Test-Path $direct) { return $direct }
  # Fallback: whatever install path the registry entry actually points at.
  foreach ($hive in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall') {
    $key = Join-Path $hive $AppId
    $entry = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
    if ($entry) {
      $cmd = if ($entry.QuietUninstallString) { $entry.QuietUninstallString } else { $entry.UninstallString }
      if ($cmd) { return $cmd }
    }
  }
  return $null
}

Say 'Orca uninstaller for Windows'

if (Get-Process -Name 'Orca' -ErrorAction SilentlyContinue) {
  Warn 'Orca is running. Close it first so it can be removed.'
  if (Confirm-Step 'Close it now?') { Stop-Process -Name 'Orca' -Force; Start-Sleep -Seconds 2 }
}

Say 'Removing the app'
$uninstaller = Find-Uninstaller
if (-not $uninstaller) {
  Warn 'No installed Orca uninstaller was found.'
}
else {
  # electron-builder's NSIS uninstaller supports a silent flag and removes its own shortcuts.
  $exe, $existingArgs = $uninstaller -split ' ', 2
  $exe = $exe.Trim('"')
  $uninstallArgs = @('/S')
  if ($existingArgs) { $uninstallArgs = @($existingArgs) + $uninstallArgs }
  Start-Process -FilePath $exe -ArgumentList $uninstallArgs -Wait
  Start-Sleep -Seconds 1
  Ok 'Orca was uninstalled'
}

Say 'Remaining shortcuts'
$removedShortcut = $false
foreach ($path in (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Orca.lnk'),
  (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\Orca')) {
  if (Test-Path $path) { Remove-Item -Recurse -Force $path; $removedShortcut = $true }
}
if ($removedShortcut) { Ok 'removed leftover shortcuts' } else { SkipStep 'none found' }

Say "Your Orca settings and history"
if ((Test-Path $UserDataDir) -or (Test-Path $UpdaterCacheDir)) {
  if (Confirm-Step "Delete Orca's saved settings, history and cache too? This cannot be undone." 'n') {
    Remove-Item -Recurse -Force $UserDataDir, $UpdaterCacheDir -ErrorAction SilentlyContinue
    Ok "deleted $UserDataDir"
  }
  else { SkipStep "kept $UserDataDir" }
}
else { SkipStep 'none found' }

Say 'The downloaded source'
if (Test-Path (Join-Path $SourceDir '.git')) {
  if (Confirm-Step "Delete the downloaded source at $SourceDir too?" 'n') {
    Remove-Item -Recurse -Force $SourceDir
    Ok "deleted $SourceDir"
  }
  else { SkipStep "kept $SourceDir" }
}
else { SkipStep "no clone found at $SourceDir" }

Say 'The build tool cache'
if (Test-Path $OrcaHome) {
  if (Confirm-Step "Delete the Node.js/pnpm build cache at $OrcaHome too?" 'n') {
    Remove-Item -Recurse -Force $OrcaHome
    Ok "deleted $OrcaHome"
  }
  else { SkipStep "kept $OrcaHome" }
}
else { SkipStep 'none found' }

Say 'Done'
Write-Host '  Orca has been uninstalled.'
