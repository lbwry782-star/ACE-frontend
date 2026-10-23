#Requires -Version 5.1
<#
.SYNOPSIS
  Launch the standalone UNDO window against a running local Vite server.
  Does not start Backend, Worker, or Frontend.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$PreferredPort = 3000
$PortScanMax = 3010
$Exe = Join-Path $RepoRoot "undo-shell\bin\AceUndo.exe"

function Write-Info([string]$Message) { Write-Host $Message -ForegroundColor Cyan }
function Write-Err([string]$Message) { Write-Host $Message -ForegroundColor Red }
function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }

function Test-AceFrontendVite([int]$Port, [string]$HostName) {
    try {
        $resp = Invoke-WebRequest -Uri "http://${HostName}:$Port/src/services/backendUrl.js" -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200 -and $resp.Content -match "LOCAL_BACKEND_URL") {
            return $true
        }
    }
    catch { }
    return $false
}

function Find-RunningAceFrontend {
    foreach ($hostName in @("localhost", "127.0.0.1")) {
        for ($port = $PreferredPort; $port -le $PortScanMax; $port++) {
            if (Test-AceFrontendVite $port $hostName) {
                return @{ HostName = $hostName; Port = $port }
            }
        }
    }
    return $null
}

if (-not (Test-Path -LiteralPath $Exe)) {
    Write-Info "UNDO shell is not built yet. Building..."
    & (Join-Path $ScriptDir "Build-AceUndoShell.ps1")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$found = Find-RunningAceFrontend
if ($null -eq $found) {
    Write-Err "Local Vite is not running. Start the frontend first, then run this script."
    Write-Err "This script does not start Backend, Worker, or Frontend."
    exit 1
}

$url = "http://$($found.HostName):$($found.Port)/#/local-undo"
Write-Ok "Opening UNDO: $url"
Start-Process -FilePath $Exe -ArgumentList @("--url", $url) | Out-Null
exit 0
