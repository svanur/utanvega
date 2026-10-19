# Syncs frontend/data/sponsors.ts → admin/src/data/sponsors.ts
#
# The two files share the same interfaces and data arrays (SPONSORS, PROMO_SLOTS, SPONSOR_ADS).
# The only difference is the header comment.
# Run this from the repo root after editing the frontend file.
#
# Usage:
#   .\scripts\sync-sponsors.ps1
#
# NOTE: this file itself must be saved with a UTF-8 BOM. The header-swap regex below
# matches a literal "─" (box-drawing) character; without a BOM, Windows PowerShell 5.1
# parses this script's source using the system codepage instead of UTF-8, corrupting
# that literal so it silently never matches the frontend file's actual header.

$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path $PSScriptRoot -Parent
$sourceFile = Join-Path $repoRoot 'frontend\data\sponsors.ts'
$targetFile = Join-Path $repoRoot 'admin\src\data\sponsors.ts'

if (-not (Test-Path $sourceFile)) {
    Write-Error "Source not found: $sourceFile"
    exit 1
}

# Read via .NET (not Get-Content -Encoding UTF8) so a leading UTF-8 BOM is decoded,
# not left in the string as a literal U+FEFF character — Windows PowerShell 5.1's
# -Encoding UTF8 does not strip it, which silently broke the header-swap regex below.
$source = [System.IO.File]::ReadAllText($sourceFile)
$source = $source.TrimStart([char]0xFEFF)

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

# Write without a BOM (UTF8Encoding($false)) so the output stays byte-identical
# across repeated runs and matches the rest of the repo's BOM-less TS files.
[System.IO.File]::WriteAllText($targetFile, $synced, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Synced:" -ForegroundColor Green
Write-Host "  $sourceFile"
Write-Host "  → $targetFile"
