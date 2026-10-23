#Requires -Version 5.1
<#
.SYNOPSIS
  Build the local UNDO WebView2 shell with the .NET Framework compiler.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$ShellDir = Join-Path $RepoRoot "undo-shell"
$RestoreDir = Join-Path $ShellDir ".restore"
$OutDir = Join-Path $ShellDir "bin"
$PackageId = "Microsoft.Web.WebView2"
$PackageVersion = "1.0.2849.39"
$Nupkg = Join-Path $RestoreDir "$PackageId.$PackageVersion.nupkg"
$ExtractDir = Join-Path $RestoreDir "$PackageId.$PackageVersion"
$Csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

function Write-Info([string]$Message) { Write-Host $Message -ForegroundColor Cyan }
function Write-Err([string]$Message) { Write-Host $Message -ForegroundColor Red }

if (-not (Test-Path -LiteralPath $Csc)) {
    Write-Err ".NET Framework C# compiler was not found at $Csc"
    Write-Err "A full .NET SDK is also not required if Framework 4.8 csc.exe exists. Install a .NET SDK or Visual Studio Build Tools, then retry."
    exit 2
}

$webviewRuntime = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if (-not $webviewRuntime) {
    $webviewRuntime = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
}
if (-not $webviewRuntime) {
    Write-Err "WebView2 Runtime was not found. Install Microsoft Edge WebView2 Runtime, then retry. No automatic install was performed."
    exit 3
}

New-Item -ItemType Directory -Force -Path $RestoreDir | Out-Null
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

if (-not (Test-Path -LiteralPath $ExtractDir)) {
    if (-not (Test-Path -LiteralPath $Nupkg)) {
        Write-Info "Downloading $PackageId $PackageVersion (WebView2 bindings only; not an SDK install)."
        $url = "https://www.nuget.org/api/v2/package/$PackageId/$PackageVersion"
        Invoke-WebRequest -Uri $url -OutFile $Nupkg -UseBasicParsing
    }
    $extractTmp = Join-Path $RestoreDir "extract-tmp"
    if (Test-Path $extractTmp) { Remove-Item $extractTmp -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $extractTmp | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($Nupkg, $extractTmp)
    Rename-Item $extractTmp $ExtractDir
}

$winFormsDll = Join-Path $ExtractDir "lib\net462\Microsoft.Web.WebView2.WinForms.dll"
$coreDll = Join-Path $ExtractDir "lib\net462\Microsoft.Web.WebView2.Core.dll"
$loader = Join-Path $ExtractDir "runtimes\win-x64\native\WebView2Loader.dll"
foreach ($path in @($winFormsDll, $coreDll, $loader)) {
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Err "WebView2 package file missing: $path"
        exit 4
    }
}

Copy-Item $winFormsDll $OutDir -Force
Copy-Item $coreDll $OutDir -Force
Copy-Item $loader $OutDir -Force

$exe = Join-Path $OutDir "AceUndo.exe"
$refs = @(
    "System.dll",
    "System.Drawing.dll",
    "System.Windows.Forms.dll",
    $winFormsDll,
    $coreDll
)
$refArgs = $refs | ForEach-Object { "/r:$_" }

Write-Info "Compiling AceUndo.exe"
& $Csc /nologo /target:winexe /platform:x64 /out:$exe /utf8output @refArgs (Join-Path $ShellDir "Program.cs")
if ($LASTEXITCODE -ne 0) {
    Write-Err "csc failed."
    exit $LASTEXITCODE
}

Write-Host "Built $exe" -ForegroundColor Green
exit 0
