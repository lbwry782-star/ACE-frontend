#Requires -Version 5.1
<#
.SYNOPSIS
  Start ACE Frontend for local development (Vite).

.DESCRIPTION
  Uses local env only, points API at 127.0.0.1:5000, never falls back to Render.
  Does not stop other processes, deploy, or start a second Vite for this project.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
Set-Location $RepoRoot

$PreferredPort = 3000
$PortScanMax = 3010
$LocalBackendUrl = "http://127.0.0.1:5000"
$NoPause = (([string]$env:ACE_FRONTEND_LOCAL_NO_PAUSE).Trim() -in @("1", "true", "yes", "on"))

function Write-Info([string]$Message) {
    Write-Host $Message -ForegroundColor Cyan
}
function Write-Ok([string]$Message) {
    Write-Host $Message -ForegroundColor Green
}
function Write-Warn([string]$Message) {
    Write-Host $Message -ForegroundColor Yellow
}
function Write-Err([string]$Message) {
    Write-Host $Message -ForegroundColor Red
}

function Invoke-LocalPause {
    if ($NoPause) {
        return
    }
    Write-Host ""
    Read-Host "Press Enter to close this window"
}

function Test-PortListening([int]$Port) {
    try {
        $hits = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return [bool]$hits
    }
    catch {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
            $ok = $iar.AsyncWaitHandle.WaitOne(250)
            if ($ok -and $client.Connected) {
                $client.Close()
                return $true
            }
            $client.Close()
        }
        catch {
            return $false
        }
        return $false
    }
}

function Get-LocalFrontendUrl([int]$Port) {
    return "http://localhost:$Port/"
}

function Test-AceFrontendVite([int]$Port) {
    $candidates = @(
        "http://127.0.0.1:$Port/src/services/backendUrl.js",
        "http://localhost:$Port/src/services/backendUrl.js"
    )
    foreach ($url in $candidates) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($resp.StatusCode -eq 200 -and $resp.Content -match "LOCAL_BACKEND_URL" -and $resp.Content -match "127\.0\.0\.1:5000") {
                return $true
            }
        }
        catch {
            continue
        }
    }
    return $false
}

function Find-RunningAceFrontendPort {
    for ($port = $PreferredPort; $port -le $PortScanMax; $port++) {
        if (Test-AceFrontendVite $port) {
            return $port
        }
    }
    return $null
}

function Find-FreeListenPort {
    for ($port = $PreferredPort; $port -le $PortScanMax; $port++) {
        if (-not (Test-PortListening $port)) {
            return $port
        }
    }
    return $null
}

function Import-DotEnvFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }
    Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) {
            return
        }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) {
            return
        }
        $name = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()
        if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Item -Path "Env:$name" -Value $value
    }
    return $true
}

function Test-PublicBackendValue([string]$Value) {
    $text = ([string]$Value).Trim().ToLowerInvariant()
    if (-not $text) {
        return $false
    }
    return ($text -match "onrender\.com" -or $text -match "ace-backend-k1p6" -or $text -match "ace-advertising\.agency")
}

Write-Info "ACE Frontend - local startup"
Write-Info "Project folder: $RepoRoot"
Write-Info "Required local backend: $LocalBackendUrl"
Write-Warn "This script does not deploy and does not change the public site."

$envFile = Join-Path $RepoRoot ".env.development.local"
if (-not (Test-Path -LiteralPath $envFile)) {
    "VITE_BACKEND_URL=$LocalBackendUrl" | Set-Content -LiteralPath $envFile -Encoding ASCII
    Write-Ok "Created local env file: .env.development.local"
}

Import-DotEnvFile $envFile | Out-Null

if (Test-PublicBackendValue $env:VITE_BACKEND_URL) {
    Write-Err "VITE_BACKEND_URL points at a public server. Local startup stopped."
    Write-Err "Set .env.development.local to $LocalBackendUrl"
    Invoke-LocalPause
    exit 1
}

$env:VITE_BACKEND_URL = $LocalBackendUrl

$existingPort = Find-RunningAceFrontendPort
if ($null -ne $existingPort) {
    $url = Get-LocalFrontendUrl $existingPort
    Write-Ok "Local Vite is already running. No second server was started."
    Write-Ok "Local site URL: $url"
    Write-Info "The orange control panel should show Backend $LocalBackendUrl"
    Invoke-LocalPause
    exit 0
}

$chosenPort = Find-FreeListenPort
if ($null -eq $chosenPort) {
    Write-Err "No free port found between $PreferredPort and $PortScanMax."
    Write-Err "Existing processes were left running. Free a port manually and try again."
    Invoke-LocalPause
    exit 1
}

if ($chosenPort -ne $PreferredPort) {
    Write-Warn "Port $PreferredPort is busy. The process using it was not stopped."
    Write-Warn "Local Vite will use port $chosenPort."
}

$packageJson = Join-Path $RepoRoot "package.json"
if (-not (Test-Path -LiteralPath $packageJson)) {
    Write-Err "package.json not found. Run this from the ACE-Frontend repository."
    Invoke-LocalPause
    exit 1
}

$viteJs = Join-Path $RepoRoot "node_modules\vite\bin\vite.js"
if (-not (Test-Path -LiteralPath $viteJs)) {
    Write-Err "Vite is not installed. Run npm install once, then try again."
    Invoke-LocalPause
    exit 1
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err "Node.js was not found."
    Invoke-LocalPause
    exit 1
}

$url = Get-LocalFrontendUrl $chosenPort
Write-Ok "Starting local site at: $url"
Write-Info "API target: $LocalBackendUrl (no Render fallback)."
Write-Info "Closing this window stops the local Vite server."
Write-Host ""

& $nodeCmd.Source $viteJs --port $chosenPort --strictPort
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Err "Vite exited with code $exitCode"
    Invoke-LocalPause
    exit $exitCode
}
exit 0
