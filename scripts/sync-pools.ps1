# Syncs frontend/data/pools.json → admin/src/data/pools.json
#
# Run this from the repo root after editing pools.json.
#
# Usage:
#   .\scripts\sync-pools.ps1

$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path $PSScriptRoot -Parent
$sourceFile = Join-Path $repoRoot 'frontend\data\pools.json'
$targetFile = Join-Path $repoRoot 'admin\src\data\pools.json'

if (-not (Test-Path $sourceFile)) {
    Write-Error "Source not found: $sourceFile"
    exit 1
}

Copy-Item -Path $sourceFile -Destination $targetFile -Force

Write-Host "Synced:" -ForegroundColor Green
Write-Host "  $sourceFile"
Write-Host "  → $targetFile"
