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
  if ($value -match '^<REPLACE_') {
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

Write-Host "==> Setting frontend Vercel env vars ($VercelEnvironment)"
Set-Location (Join-Path $repoRoot "frontend")
$stagingApiUrl | vercel env add VITE_API_URL $VercelEnvironment
$SupabaseUrl | vercel env add VITE_SUPABASE_URL $VercelEnvironment
$SupabaseAnonKey | vercel env add VITE_SUPABASE_ANON_KEY $VercelEnvironment
$StagingFrontendUrl | vercel env add VITE_AUTH_REDIRECT_URL $VercelEnvironment

Write-Host "==> Setting admin Vercel env vars ($VercelEnvironment)"
Set-Location (Join-Path $repoRoot "admin")
$stagingApiUrl | vercel env add VITE_API_URL $VercelEnvironment
$SupabaseUrl | vercel env add VITE_SUPABASE_URL $VercelEnvironment
$SupabaseAnonKey | vercel env add VITE_SUPABASE_ANON_KEY $VercelEnvironment

Write-Host "==> Done"
Write-Host "Next:"
Write-Host "1) Ensure frontend/admin projects are linked to their staging Vercel projects."
Write-Host "2) Deploy backend on Fly and deploy frontend/admin on Vercel."
