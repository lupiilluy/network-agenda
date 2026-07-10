param(
  [switch]$Strict
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param(
    [string]$Path
  )

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }
    $parts = $line -split "=", 2
    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim("'`"")
    $values[$key] = $value
  }

  return $values
}

function Mask-Value {
  param(
    [string]$Value
  )

  if (-not $Value) {
    return "<empty>"
  }
  if ($Value.Length -le 8) {
    return "***"
  }
  return "$($Value.Substring(0, 6))***"
}

function Merge-ProcessEnv {
  param(
    [hashtable]$Target,
    [string[]]$Keys
  )

  foreach ($key in $Keys) {
    $value = [System.Environment]::GetEnvironmentVariable($key)
    if ($null -ne $value -and $value -ne "") {
      $Target[$key] = $value
    }
  }
}

$root = Split-Path -Parent $PSScriptRoot
$frontendEnvLocal = Read-EnvFile -Path (Join-Path $root "frontend/.env.local")
$frontendEnvProdLocal = Read-EnvFile -Path (Join-Path $root "frontend/.env.production.local")
$frontendEnv = @{}
foreach ($entry in $frontendEnvProdLocal.GetEnumerator()) {
  $frontendEnv[$entry.Key] = $entry.Value
}
foreach ($entry in $frontendEnvLocal.GetEnumerator()) {
  $frontendEnv[$entry.Key] = $entry.Value
}
Merge-ProcessEnv -Target $frontendEnv -Keys @("VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_GOOGLE_CLIENT_ID", "VITE_WEB_PUSH_PUBLIC_KEY", "VITE_GOOGLE_MAPS_API_KEY")
$backendEnvLocal = Read-EnvFile -Path (Join-Path $root "backend/.env.local")
$backendEnvProdLocal = Read-EnvFile -Path (Join-Path $root "backend/.env.production.local")
$backendEnv = @{}
foreach ($entry in $backendEnvProdLocal.GetEnumerator()) {
  $backendEnv[$entry.Key] = $entry.Value
}
foreach ($entry in $backendEnvLocal.GetEnumerator()) {
  $backendEnv[$entry.Key] = $entry.Value
}
Merge-ProcessEnv -Target $backendEnv -Keys @("DATABASE_URL", "APP_ENV", "SUPABASE_URL", "SUPABASE_JWT_SECRET", "CORS_ALLOWED_ORIGINS", "ALLOW_LEGACY_PASSWORD_LOGIN", "OPENAI_API_KEY", "OPENAI_MODEL", "WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_VAPID_SUBJECT")

$frontendMissing = @()
foreach ($key in @("VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY")) {
  if (-not $frontendEnv.ContainsKey($key) -or -not $frontendEnv[$key]) {
    $frontendMissing += $key
  }
}
$frontendPushMissing = @()
if (-not $frontendEnv.ContainsKey("VITE_WEB_PUSH_PUBLIC_KEY") -or -not $frontendEnv["VITE_WEB_PUSH_PUBLIC_KEY"]) {
  $frontendPushMissing += "VITE_WEB_PUSH_PUBLIC_KEY"
}
$frontendBackendMismatch = $false
if (
  $frontendEnv.ContainsKey("VITE_SUPABASE_URL") -and $frontendEnv["VITE_SUPABASE_URL"] -and
  $backendEnv.ContainsKey("SUPABASE_URL") -and $backendEnv["SUPABASE_URL"] -and
  $frontendEnv["VITE_SUPABASE_URL"].TrimEnd("/") -ne $backendEnv["SUPABASE_URL"].TrimEnd("/")
) {
  $frontendBackendMismatch = $true
}

$backendMissing = @()
if (-not $backendEnv.ContainsKey("DATABASE_URL") -or -not $backendEnv["DATABASE_URL"]) {
  $backendMissing += "DATABASE_URL"
}
if (-not $backendEnv.ContainsKey("APP_ENV") -or $backendEnv["APP_ENV"].ToLowerInvariant() -ne "production") {
  $backendMissing += "APP_ENV=production"
}
if ((-not $backendEnv.ContainsKey("SUPABASE_URL") -or -not $backendEnv["SUPABASE_URL"]) -and (-not $backendEnv.ContainsKey("SUPABASE_JWT_SECRET") -or -not $backendEnv["SUPABASE_JWT_SECRET"])) {
  $backendMissing += "SUPABASE_URL or SUPABASE_JWT_SECRET"
}
if (-not $backendEnv.ContainsKey("CORS_ALLOWED_ORIGINS") -or -not $backendEnv["CORS_ALLOWED_ORIGINS"]) {
  $backendMissing += "CORS_ALLOWED_ORIGINS"
}
$backendPushMissing = @()
foreach ($key in @("WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_VAPID_SUBJECT")) {
  if (-not $backendEnv.ContainsKey($key) -or -not $backendEnv[$key]) {
    $backendPushMissing += $key
  }
}

Write-Output "Frontend env"
foreach ($key in @("VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_GOOGLE_CLIENT_ID")) {
  $value = if ($frontendEnv.ContainsKey($key)) { $frontendEnv[$key] } else { "" }
  Write-Output "  $key = $(Mask-Value $value)"
}
foreach ($key in @("VITE_WEB_PUSH_PUBLIC_KEY")) {
  $value = if ($frontendEnv.ContainsKey($key)) { $frontendEnv[$key] } else { "" }
  Write-Output "  $key = $(Mask-Value $value)"
}

Write-Output ""
Write-Output "Backend env"
foreach ($key in @("DATABASE_URL", "APP_ENV", "SUPABASE_URL", "SUPABASE_JWT_SECRET", "CORS_ALLOWED_ORIGINS", "ALLOW_LEGACY_PASSWORD_LOGIN")) {
  $value = if ($backendEnv.ContainsKey($key)) { $backendEnv[$key] } else { "" }
  Write-Output "  $key = $(Mask-Value $value)"
}
foreach ($key in @("WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_VAPID_SUBJECT")) {
  $value = if ($backendEnv.ContainsKey($key)) { $backendEnv[$key] } else { "" }
  Write-Output "  $key = $(Mask-Value $value)"
}

Write-Output ""
if ($frontendMissing.Count -eq 0) {
  Write-Output "Frontend auth readiness: OK"
} else {
  Write-Output "Frontend auth readiness: missing $($frontendMissing -join ', ')"
}
if ($frontendPushMissing.Count -eq 0) {
  Write-Output "Frontend push readiness: OK"
} else {
  Write-Output "Frontend push readiness: missing $($frontendPushMissing -join ', ')"
}

if ($backendMissing.Count -eq 0) {
  Write-Output "Backend auth readiness: OK"
} else {
  Write-Output "Backend auth readiness: missing $($backendMissing -join ', ')"
}
if ($backendPushMissing.Count -eq 0) {
  Write-Output "Backend push readiness: OK"
} else {
  Write-Output "Backend push readiness: missing $($backendPushMissing -join ', ')"
}
if ($frontendBackendMismatch) {
  Write-Output "Supabase URL alignment: mismatch between frontend and backend"
} else {
  Write-Output "Supabase URL alignment: OK"
}

$apiBaseUrl = if ($frontendEnv.ContainsKey("VITE_API_URL") -and $frontendEnv["VITE_API_URL"]) {
  $frontendEnv["VITE_API_URL"].TrimEnd("/")
} else {
  "http://127.0.0.1:8006"
}

$strictFailures = @()
if ($frontendMissing.Count -gt 0) {
  $strictFailures += "Frontend auth env incompleto"
}
if ($backendMissing.Count -gt 0) {
  $strictFailures += "Backend auth env incompleto"
}
if ($frontendBackendMismatch) {
  $strictFailures += "SUPABASE_URL diferente entre frontend e backend"
}

try {
  $response = Invoke-RestMethod -Uri "$apiBaseUrl/api/auth/status" -Method Get -TimeoutSec 8
  Write-Output ""
  Write-Output "Backend /api/auth/status"
  Write-Output "  supabase_auth_required = $($response.supabase_auth_required)"
  Write-Output "  production_auth_enforced = $($response.production_auth_enforced)"
  Write-Output "  demo_fallback_enabled = $($response.demo_fallback_enabled)"
  Write-Output "  configured_supabase_url = $($response.configured_supabase_url)"
  Write-Output "  configured_supabase_jwt_secret = $($response.configured_supabase_jwt_secret)"
  Write-Output "  configured_web_push_vapid = $($response.configured_web_push_vapid)"
  Write-Output "  jwt_library_available = $($response.jwt_library_available)"
  Write-Output "  legacy_password_login_enabled = $($response.legacy_password_login_enabled)"
  Write-Output "  jwt_validation_mode = $($response.jwt_validation_mode)"
  Write-Output "  database_dialect = $($response.database_dialect)"
  Write-Output "  rls_supported = $($response.rls_supported)"
  Write-Output "  rls_ready = $($response.rls_ready)"
  Write-Output "  rls_enabled_tables = $($response.rls_enabled_tables)/$($response.rls_total_tables)"
  Write-Output "  production_auth_ready = $($response.production_auth_ready)"
  Write-Output "  authenticated = $($response.authenticated)"
  if ($response.warnings) {
    Write-Output "  warnings:"
    foreach ($warning in $response.warnings) {
      Write-Output "    - $warning"
    }
  }
  if (-not $response.production_auth_ready) {
    $strictFailures += "Backend reporta production_auth_ready=false"
  }
  if (-not $response.production_auth_enforced) {
    $strictFailures += "Backend nao esta com APP_ENV=production"
  }
  if ($response.demo_fallback_enabled) {
    $strictFailures += "Fallback demo-user ainda esta ativo"
  }
} catch {
  Write-Output ""
  Write-Output "Backend /api/auth/status: not reachable at $apiBaseUrl"
  $strictFailures += "API auth/status indisponivel"
}

try {
  $graphResponse = Invoke-RestMethod -Uri "$apiBaseUrl/api/graph?scope=public" -Method Get -TimeoutSec 8
  Write-Output ""
  Write-Output "Backend /api/graph public"
  Write-Output "  nodes = $($graphResponse.nodes.Count)"
  Write-Output "  edges = $($graphResponse.edges.Count)"
} catch {
  Write-Output ""
  Write-Output "Backend /api/graph: not reachable at $apiBaseUrl"
  $strictFailures += "API graph indisponivel"
}

if ($Strict -and $strictFailures.Count -gt 0) {
  Write-Output ""
  Write-Output "Strict readiness: FAIL"
  foreach ($failure in $strictFailures | Select-Object -Unique) {
    Write-Output "  - $failure"
  }
  exit 1
}

if ($Strict) {
  Write-Output ""
  Write-Output "Strict readiness: OK"
}
