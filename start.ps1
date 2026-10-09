param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$env:PORT = "$Port"
Set-Location -LiteralPath $PSScriptRoot
$orientNode = Get-Command node -ErrorAction SilentlyContinue
if ($orientNode) { & $orientNode.Source (Join-Path $PSScriptRoot 'server.cjs'); exit $LASTEXITCODE }
throw 'Node.js is required. Install Node.js, then run this script again.'
