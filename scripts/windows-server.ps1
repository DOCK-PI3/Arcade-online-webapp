param(
    [ValidateSet('Install', 'Start')][string]$Mode = 'Start',
    [switch]$Check,
    [switch]$LocalOnly
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$nodeVersion = '24.15.0'
$nodeFolder = Join-Path $projectRoot ".cache\node\node-v$nodeVersion-win-x64"

function Test-ArcadeNode([string]$Executable) {
    if (-not $Executable -or -not (Test-Path -LiteralPath $Executable)) { return $false }
    & $Executable -e 'const [a,b]=process.versions.node.split(String.fromCharCode(46)).map(Number);process.exit(a===24 && b>=15 ? 0 : 1)' 2>$null
    return $LASTEXITCODE -eq 0
}

try {
    $nodeExecutable = Join-Path $nodeFolder 'node.exe'
    if (-not (Test-ArcadeNode $nodeExecutable)) {
        $existingNode = Get-Command node.exe -ErrorAction SilentlyContinue
        $nodeExecutable = if ($existingNode) { $existingNode.Source } else { $null }
    }
    if (-not (Test-ArcadeNode $nodeExecutable)) {
        if ($Mode -ne 'Install' -or $Check) {
            throw 'Falta Node.js 24.15 o posterior de la rama 24. Ejecuta Instalar-Windows.cmd.'
        }
        if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
            throw 'La instalacion automatica de Windows requiere un equipo x64.'
        }
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $downloadFolder = Join-Path $projectRoot '.cache\node'
        New-Item -ItemType Directory -Path $downloadFolder -Force | Out-Null
        $archive = Join-Path $downloadFolder "node-v$nodeVersion-win-x64.zip"
        Write-Host "Descargando Node.js $nodeVersion desde nodejs.org..."
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip" -OutFile "$archive.partial" -UseBasicParsing -TimeoutSec 180
        # https://nodejs.org/dist/v24.15.0/SHASUMS256.txt
        $expected = 'cc5149eabd53779ce1e7bdc5401643622d0c7e6800ade18928a767e940bb0e62'
        if ((Get-FileHash -LiteralPath "$archive.partial" -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
            throw 'El hash de Node.js no coincide. No se extraera el archivo.'
        }
        Move-Item -LiteralPath "$archive.partial" -Destination $archive -Force
        Expand-Archive -LiteralPath $archive -DestinationPath $downloadFolder -Force
        $nodeExecutable = Join-Path $nodeFolder 'node.exe'
        if (-not (Test-ArcadeNode $nodeExecutable)) { throw 'No se pudo preparar Node.js.' }
    }
    $env:PATH = (Split-Path -Parent $nodeExecutable) + [IO.Path]::PathSeparator + $env:PATH
    if ($Check) {
        & $nodeExecutable --env-file-if-exists=.env scripts/setup-server.mjs check
    } elseif ($Mode -eq 'Install') {
        & $nodeExecutable --env-file-if-exists=.env scripts/setup-server.mjs install
    } else {
        & $nodeExecutable --env-file-if-exists=.env scripts/setup-server.mjs check
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        if ($LocalOnly) {
            & $nodeExecutable --env-file-if-exists=.env server/index.js
        } else {
            if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.cache\caddy\caddy.exe'))) {
                throw 'Falta el proxy HTTPS. Ejecuta Instalar-Windows.cmd o usa Iniciar-Windows.cmd -LocalOnly.'
            }
            & $nodeExecutable --env-file-if-exists=.env scripts/start-network.mjs
        }
    }
    exit $LASTEXITCODE
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
