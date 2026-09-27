# Builds Orca and installs it for the current user (Windows).
# Checks the build tools first and asks before installing anything.
# Run it from a checkout, or straight from GitHub (it clones the repo itself):
#   powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/raybello/orca/main/config/installers/install-orca-windows.ps1 -OutFile $env:TEMP\install-orca.ps1; & $env:TEMP\install-orca.ps1"
[CmdletBinding()]
param(
  [switch]$Yes,
  [switch]$Elevated
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Windows PowerShell 5.1 can default to old TLS versions that nodejs.org and cursor.com reject.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoUrl = if ($env:ORCA_REPO_URL) { $env:ORCA_REPO_URL } else { 'https://github.com/raybello/orca.git' }
$RepoBranch = if ($env:ORCA_BRANCH) { $env:ORCA_BRANCH } else { 'main' }
$SourceDir = if ($env:ORCA_SOURCE_DIR) { $env:ORCA_SOURCE_DIR } else { Join-Path $env:USERPROFILE 'Orca' }
$RepoRoot = $null
$OrcaHome = if ($env:ORCA_BUILD_HOME) { $env:ORCA_BUILD_HOME } else { Join-Path $env:LOCALAPPDATA 'OrcaBuild' }
$NodeDir = Join-Path $OrcaHome 'node'
$ToolsDir = Join-Path $OrcaHome 'tools'
$LogDir = Join-Path $OrcaHome 'logs'

function Say($Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Ok($Message) { Write-Host "  [ok] $Message" -ForegroundColor Green }
function Warn($Message) { Write-Host "  [!] $Message" -ForegroundColor Yellow }
function Fail($Message) { throw $Message }

# Returns $true for yes. Default is yes.
function Confirm-Step($Question) {
  if ($Yes) { return $true }
  $reply = Read-Host "  $Question [Y/n]"
  return -not ($reply -match '^(n|no)$')
}

function Update-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$NodeDir;$ToolsDir;$machine;$user"
}

# Fails the script when a native command exits non-zero.
function Invoke-Checked {
  param([string]$Command, [string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { Fail "'$Command $($Arguments -join ' ')' failed (exit code $LASTEXITCODE)." }
}

function Wait-BeforeClosing {
  if ($Elevated) { Read-Host "`nPress Enter to close this window" | Out-Null }
}

# Administrator rights: build tools install and the packager's symlinks both need them.
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'This installer needs Administrator rights to install build tools.'
  Write-Host 'Windows will ask for permission next.'
  $relaunch = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Elevated')
  if ($Yes) { $relaunch += '-Yes' }
  Start-Process -FilePath 'powershell.exe' -ArgumentList $relaunch -Verb RunAs | Out-Null
  exit 0
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$logFile = Join-Path $LogDir ("install-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
Start-Transcript -Path $logFile | Out-Null

try {
  if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { Fail 'This script supports 64-bit Intel/AMD Windows only (not Windows on ARM).' }

  Say 'Orca installer for Windows'
  Write-Host "  Log file: $logFile"
  Update-SessionPath

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  function Install-WithWinget($Id, [string[]]$Extra = @()) {
    if (-not $winget) { Fail 'winget is missing. Install "App Installer" from the Microsoft Store, then run this again.' }
    $wingetArgs = @('install', '--id', $Id, '-e', '--accept-package-agreements', '--accept-source-agreements') + $Extra
    Invoke-Checked 'winget' $wingetArgs
    Update-SessionPath
  }

  # --- Git ---
  Say 'Checking Git'
  if (Get-Command git -ErrorAction SilentlyContinue) { Ok (git --version) }
  else {
    Warn 'Git was not found.'
    if (-not (Confirm-Step 'Install Git with winget?')) { Fail 'Cannot build without Git.' }
    Install-WithWinget 'Git.Git'
    Ok 'installed Git'
  }

  # --- Source code: this checkout, or a fresh clone ---
  Say 'Getting the Orca source'
  $checkout = if ($PSScriptRoot) { Join-Path $PSScriptRoot '..\..' } else { $null }
  if ($checkout -and (Test-Path (Join-Path $checkout 'package.json')) -and (Test-Path (Join-Path $checkout 'config\electron-builder.config.cjs'))) {
    $RepoRoot = (Resolve-Path $checkout).Path
    Ok "using this checkout: $RepoRoot"
  }
  elseif (Test-Path (Join-Path $SourceDir '.git')) {
    $RepoRoot = $SourceDir
    Ok "found $SourceDir"
    if (Confirm-Step "Update it to the latest $RepoBranch?") {
      try { Invoke-Checked 'git' @('-C', $SourceDir, 'pull', '--ff-only', 'origin', $RepoBranch) }
      catch { Warn 'Could not update; building the copy you have.' }
    }
  }
  elseif (Test-Path $SourceDir) { Fail "$SourceDir already exists and is not an Orca checkout. Move it or set ORCA_SOURCE_DIR." }
  else {
    if (-not (Confirm-Step "Download Orca from $RepoUrl into $SourceDir?")) { Fail 'Cannot build without the source.' }
    Invoke-Checked 'git' @('clone', '--depth', '1', '--branch', $RepoBranch, $RepoUrl, $SourceDir)
    $RepoRoot = $SourceDir
    Ok "downloaded to $SourceDir"
  }

  # --- Python (node-gyp) ---
  Say 'Checking Python'
  $python = Get-Command python -ErrorAction SilentlyContinue
  $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
  if (($python -and ($python.Source -notmatch 'WindowsApps')) -or $pyLauncher) { Ok 'found' }
  else {
    Warn 'Python was not found (needed to compile native modules).'
    if (-not (Confirm-Step 'Install Python 3.12 with winget?')) { Fail 'Cannot build without Python.' }
    Install-WithWinget 'Python.Python.3.12'
    Ok 'installed Python'
  }

  # --- Visual Studio C++ Build Tools ---
  Say 'Checking Visual Studio C++ Build Tools'
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  $hasBuildTools = $false
  if (Test-Path $vswhere) {
    $found = & $vswhere -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -latest -property installationPath
    $hasBuildTools = [bool]$found
  }
  if ($hasBuildTools) { Ok 'found' }
  else {
    Warn 'The C++ build tools are missing (about 3-6 GB, needed to compile native modules).'
    if (-not (Confirm-Step 'Install Visual Studio Build Tools with winget? This can take 10+ minutes.')) { Fail 'Cannot build without the C++ build tools.' }
    try {
      Install-WithWinget 'Microsoft.VisualStudio.2022.BuildTools' @(
        '--override', '--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')
    }
    catch {
      Fail 'Build Tools did not install. If Visual Studio is already installed, open Visual Studio Installer, choose Modify, tick "Desktop development with C++", then run this again.'
    }
    Ok 'installed Build Tools'
  }

  # --- Node.js (major version pinned by package.json engines) ---
  $packageJson = Get-Content (Join-Path $RepoRoot 'package.json') -Raw | ConvertFrom-Json
  $wantMajor = ($packageJson.engines.node -replace '[^\d].*$', '')
  Say "Checking Node.js $wantMajor"
  $nodeMajor = $null
  if (Get-Command node -ErrorAction SilentlyContinue) { $nodeMajor = ((node --version) -replace '^v', '') -split '\.' | Select-Object -First 1 }
  if ($nodeMajor -eq $wantMajor) { Ok "found $(node --version)" }
  else {
    Warn "Node.js $wantMajor was not found."
    if (-not (Confirm-Step "Download Node.js $wantMajor from nodejs.org into $NodeDir?")) { Fail 'Cannot build without Node.js.' }
    $base = "https://nodejs.org/dist/latest-v$wantMajor.x"
    $sums = (Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt").Content -split "`n"
    $line = $sums | Where-Object { $_ -match '-win-x64\.zip$' } | Select-Object -First 1
    if (-not $line) { Fail "Could not find a Node.js $wantMajor download." }
    $expected, $archive = ($line.Trim() -split '\s+')
    $zip = Join-Path ([IO.Path]::GetTempPath()) $archive
    Invoke-WebRequest -UseBasicParsing "$base/$archive" -OutFile $zip
    if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $expected.ToLower()) { Fail 'Node.js download failed its checksum.' }
    if (Test-Path $NodeDir) { Remove-Item -Recurse -Force $NodeDir }
    $extract = Join-Path ([IO.Path]::GetTempPath()) 'orca-node-extract'
    if (Test-Path $extract) { Remove-Item -Recurse -Force $extract }
    Expand-Archive -Path $zip -DestinationPath $extract
    New-Item -ItemType Directory -Force -Path $OrcaHome | Out-Null
    Move-Item (Join-Path $extract ($archive -replace '\.zip$', '')) $NodeDir
    Remove-Item -Recurse -Force $extract, $zip
    Update-SessionPath
    Ok "installed $(node --version)"
  }

  # --- pnpm ---
  $pnpmVersion = if ($packageJson.packageManager -match '^pnpm@([\d.]+)') { $Matches[1] } else { 'latest' }
  Say 'Checking pnpm'
  $pnpmOk = $false
  if (Get-Command pnpm -ErrorAction SilentlyContinue) { $pnpmOk = [int](((pnpm --version) -split '\.')[0]) -ge 10 }
  if ($pnpmOk) { Ok "found pnpm $(pnpm --version)" }
  else {
    Warn 'pnpm was not found.'
    if (-not (Confirm-Step "Install pnpm $pnpmVersion into $ToolsDir?")) { Fail 'Cannot build without pnpm.' }
    Invoke-Checked 'npm' @('install', '-g', "pnpm@$pnpmVersion", '--prefix', $ToolsDir)
    Update-SessionPath
    Ok "installed pnpm $(pnpm --version)"
  }

  # --- Cursor CLI ---
  function Find-CursorAgent {
    foreach ($name in 'cursor-agent', 'agent') {
      $cmd = Get-Command $name -ErrorAction SilentlyContinue
      if ($cmd) { return $cmd.Source }
    }
    foreach ($dir in (Join-Path $env:LOCALAPPDATA 'cursor-agent'), (Join-Path $env:USERPROFILE '.local\bin')) {
      foreach ($name in 'cursor-agent.exe', 'agent.exe', 'cursor-agent.cmd', 'agent.cmd') {
        $candidate = Join-Path $dir $name
        if (Test-Path $candidate) { return $candidate }
      }
    }
    return $null
  }

  Say 'Checking Cursor CLI'
  $cursorAgent = Find-CursorAgent
  $needsLogin = $false
  if ($cursorAgent) {
    Ok "found $cursorAgent"
    if (Confirm-Step 'Sign in to Cursor now?') { $needsLogin = $true }
  }
  elseif (Confirm-Step "Cursor CLI is not installed. Install it now? (runs Cursor's installer from https://cursor.com/install)") {
    Invoke-RestMethod 'https://cursor.com/install?win32=true' | Invoke-Expression
    Update-SessionPath
    $cursorAgent = Find-CursorAgent
    if ($cursorAgent) { Ok "installed $cursorAgent" } else { Warn 'Installed, but the command was not found. Open a new PowerShell window and run: agent login' }
    $needsLogin = $true
  }
  else { Warn 'Skipping Cursor CLI.' }
  if ($needsLogin -and $cursorAgent) {
    Write-Host '  Your browser will open so you can sign in to Cursor.'
    & $cursorAgent login
    if ($LASTEXITCODE -ne 0) { Warn "Sign-in did not finish. Run 'agent login' later to try again." }
  }

  # --- Build ---
  Set-Location $RepoRoot
  $env:NODE_OPTIONS = '--max-old-space-size=4096'
  $env:GYP_MSVS_VERSION = '2022'

  Say 'Installing dependencies (a few minutes)'
  Invoke-Checked 'pnpm' @('install', '--frozen-lockfile')
  Push-Location (Join-Path $RepoRoot 'mobile')
  try { Invoke-Checked 'pnpm' @('install', '--frozen-lockfile') } finally { Pop-Location }

  Say 'Building Orca (10-20 minutes the first time)'
  Invoke-Checked 'pnpm' @('run', 'build:release')
  Invoke-Checked 'pnpm' @('run', 'ensure:electron-runtime')

  Say 'Packaging the installer'
  $commit = $null
  try { $commit = (git rev-parse --short=12 HEAD 2>$null) } catch { $commit = $null }
  if (-not $commit) { $commit = 'nogit' }
  $version = $packageJson.version
  $separator = if ($version.Contains('-')) { '.' } else { '-' }
  $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $env:ORCA_LOCAL_BUILD_VERSION = "$version${separator}local.$timestamp.$commit"
  $env:ORCA_BUILD_COMMIT = $commit
  $env:ORCA_REUSE_PREPARED_NATIVE_RUNTIME = '1'
  $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  Invoke-Checked 'pnpm' @('exec', 'electron-builder', '--config', 'config/electron-builder.config.cjs', '--win')

  $setup = Get-ChildItem (Join-Path $RepoRoot 'dist') -Filter '*.exe' | Where-Object { $_.Name -match 'setup' } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $setup) { Fail 'The build finished but no installer was found in dist\.' }

  # --- Install ---
  Say 'Installing Orca'
  if (Get-Process -Name 'Orca' -ErrorAction SilentlyContinue) {
    Warn 'Orca is running. Close it so it can be replaced.'
    if (Confirm-Step 'Close it now?') { Stop-Process -Name 'Orca' -Force; Start-Sleep -Seconds 3 }
  }
  # The installer adds the Start menu and Desktop shortcuts and an uninstall entry.
  Start-Process -FilePath $setup.FullName -ArgumentList '/S' -Wait
  Ok 'installed (Start menu and Desktop shortcuts created)'

  Say 'Done'
  Write-Host "  Installer kept at: $($setup.FullName)"
  $shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Orca.lnk'
  if ((Test-Path $shortcut) -and (Confirm-Step 'Open Orca now?')) { Start-Process $shortcut }
}
catch {
  Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Full log: $logFile"
  Stop-Transcript | Out-Null
  Wait-BeforeClosing
  exit 1
}
Stop-Transcript | Out-Null
Wait-BeforeClosing
