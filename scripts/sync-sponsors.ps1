# Syncs frontend/data/sponsors.ts → admin/src/data/sponsors.ts
#
# The two files share the same interfaces and data arrays (SPONSORS, PROMO_SLOTS, SPONSOR_ADS).
# The only difference is the header comment.
# Run this from the repo root after editing the frontend file.
#
# Usage:
#   .\scripts\sync-sponsors.ps1

$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path $PSScriptRoot -Parent
$sourceFile = Join-Path $repoRoot 'frontend\data\sponsors.ts'
$targetFile = Join-Path $repoRoot 'admin\src\data\sponsors.ts'

if (-not (Test-Path $sourceFile)) {
    Write-Error "Source not found: $sourceFile"
    exit 1
}

$source = Get-Content $sourceFile -Raw -Encoding UTF8

# Replace the frontend header block (everything up to the blank line before `export interface`)
# with the admin-specific header.
$adminHeader = @'
// KEEP IN SYNC with frontend/data/sponsors.ts
// This is a read-only mirror for display in the admin UI.
// To add or change sponsors/promos, edit the frontend file and run:
//   .\scripts\sync-sponsors.ps1
'@

# The frontend header starts with `// ─` and ends just before `export interface`
$synced = $source -replace '(?s)^// ─.*?(?=export interface)', "$adminHeader`n`n"

# Ensure the target directory exists
$targetDir = Split-Path $targetFile -Parent
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

Set-Content -Path $targetFile -Value $synced -Encoding UTF8 -NoNewline

Write-Host "Synced:" -ForegroundColor Green
Write-Host "  $sourceFile"
Write-Host "  → $targetFile"
