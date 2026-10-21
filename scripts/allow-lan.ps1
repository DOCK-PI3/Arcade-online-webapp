$ErrorActionPreference = 'Stop'
if (!([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Wait
    exit $LASTEXITCODE
}
$projectDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$proxyProgram = Join-Path $projectDirectory '.cache\caddy\caddy.exe'
$chromeProgram = (Get-ChildItem -Path (Join-Path $projectDirectory '.cache\server-browsers\chromium-*\chrome-win64\chrome.exe') | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
$httpsPort = 443
$runtimeFile = Join-Path $projectDirectory 'data\network-runtime.json'
if (Test-Path -LiteralPath $runtimeFile) { $httpsPort = (Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json).settings.httpsPort }
if (!(Test-Path -LiteralPath $proxyProgram) -or !(Test-Path -LiteralPath $chromeProgram)) { throw 'Instala antes Caddy y Chromium desde el proyecto.' }
# Solo red privada y equipos de la misma subred. No abre puertos del router.
foreach ($ruleName in @('SalonArcade-LAN-HTTPS','SalonArcade-LAN-WebRTC')) {
    Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
}
New-NetFirewallRule -Name 'SalonArcade-LAN-HTTPS' -DisplayName 'Salon Arcade - HTTPS y preparacion LAN' -Direction Inbound -Action Allow -Profile Private -RemoteAddress LocalSubnet -Program $proxyProgram -Protocol TCP -LocalPort $httpsPort,3000 | Out-Null
New-NetFirewallRule -Name 'SalonArcade-LAN-WebRTC' -DisplayName 'Salon Arcade - Video WebRTC LAN' -Direction Inbound -Action Allow -Profile Private -RemoteAddress LocalSubnet -Program $chromeProgram -Protocol UDP | Out-Null
Write-Host 'Acceso permitido solo desde la red local privada.'
