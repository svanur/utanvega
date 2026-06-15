param(
  [string]$FlyStagingApp = "<REPLACE_FLY_STAGING_APP>",
  [string]$DatabaseUrl = "<REPLACE_STAGING_DATABASE_URL>",
  [string]$SupabaseUrl = "<REPLACE_STAGING_SUPABASE_URL>",
  [string]$SupabaseJwtSecret = "<REPLACE_STAGING_SUPABASE_JWT_SECRET>",
  [string]$SupabaseAnonKey = "<REPLACE_STAGING_SUPABASE_ANON_KEY>",
  [string]$StagingFrontendUrl = "https://staging.hlaupadagskra.vercel.app",
  [string]$StagingAdminUrl = "https://admin-staging.hlaupadagskra.vercel.app",
  [string]$VercelEnvironment = "production"
)

function Assert-Replaced([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^<REPLACE_') {
    throw "Please set $name before running this script."
  }
}

Assert-Replaced "FlyStagingApp" $FlyStagingApp
Assert-Replaced "DatabaseUrl" $DatabaseUrl
Assert-Replaced "SupabaseUrl" $SupabaseUrl
Assert-Replaced "SupabaseJwtSecret" $SupabaseJwtSecret
Assert-Replaced "SupabaseAnonKey" $SupabaseAnonKey

$repoRoot = Split-Path -Parent $PSScriptRoot
$stagingApiUrl = "https://$FlyStagingApp.fly.dev"

Write-Host "==> Setting Fly secrets on app '$FlyStagingApp'"
Set-Location $repoRoot
fly secrets set -a $FlyStagingApp `
  ASPNETCORE_ENVIRONMENT=Staging `
  DATABASE_URL="$DatabaseUrl" `
  SUPABASE_URL="$SupabaseUrl" `
  SUPABASE_JWT_SECRET="$SupabaseJwtSecret" `
  AllowedOrigins__0="$StagingFrontendUrl" `
  AllowedOrigins__1="$StagingAdminUrl"

if ($LASTEXITCODE -ne 0) {
  throw "fly secrets set failed with exit code $LASTEXITCODE"
}

Write-Host "==> Setting frontend Vercel env vars ($VercelEnvironment)"
Set-Location (Join-Path $repoRoot "frontend")
$stagingApiUrl | vercel env add VITE_API_URL $VercelEnvironment
if ($LASTEXITCODE -ne 0) { throw "vercel env add VITE_API_URL failed" }
$SupabaseUrl | vercel env add VITE_SUPABASE_URL $VercelEnvironment
if ($LASTEXITCODE -ne 0) { throw "vercel env add VITE_SUPABASE_URL failed" }
$SupabaseAnonKey | vercel env add VITE_SUPABASE_ANON_KEY $VercelEnvironment
if ($LASTEXITCODE -ne 0) { throw "vercel env add VITE_SUPABASE_ANON_KEY failed" }
$StagingFrontendUrl | vercel env add VITE_AUTH_REDIRECT_URL $VercelEnvironment
if ($LASTEXITCODE -ne 0) { throw "vercel env add VITE_AUTH_REDIRECT_URL failed" }

Write-Host "==> Setting admin Vercel env vars ($VercelEnvironment)"
Set-Location (Join-Path $repoRoot "admin")
$stagingApiUrl | vercel env add VITE_API_URL $VercelEnvironment
if ($LASTEXITCODE -ne 0) { throw "vercel env add VITE_API_URL (admin) failed" }
$SupabaseUrl | vercel env add VITE_SUPABASE_URL $VercelEnvironment
if ($LASTEXITCODE -ne 0) { throw "vercel env add VITE_SUPABASE_URL (admin) failed" }
$SupabaseAnonKey | vercel env add VITE_SUPABASE_ANON_KEY $VercelEnvironment
if ($LASTEXITCODE -ne 0) { throw "vercel env add VITE_SUPABASE_ANON_KEY (admin) failed" }

Write-Host "==> Done"
Write-Host "Next:"
Write-Host "1) Ensure frontend/admin projects are linked to their staging Vercel projects."
Write-Host "2) Deploy backend on Fly and deploy frontend/admin on Vercel."
