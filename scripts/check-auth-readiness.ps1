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
Merge-ProcessEnv -Target $frontendEnv -Keys @("VITE_API_URL", "VITE_GOOGLE_CLIENT_ID", "VITE_WEB_PUSH_PUBLIC_KEY", "VITE_GOOGLE_MAPS_API_KEY")
$backendEnvLocal = Read-EnvFile -Path (Join-Path $root "backend/.env.local")
$backendEnvProdLocal = Read-EnvFile -Path (Join-Path $root "backend/.env.production.local")
$backendEnv = @{}
foreach ($entry in $backendEnvProdLocal.GetEnumerator()) {
  $backendEnv[$entry.Key] = $entry.Value
}
foreach ($entry in $backendEnvLocal.GetEnumerator()) {
  $backendEnv[$entry.Key] = $entry.Value
}
Merge-ProcessEnv -Target $backendEnv -Keys @("DATABASE_URL", "APP_ENV", "CORS_ALLOWED_ORIGINS", "ALLOW_LEGACY_PASSWORD_LOGIN", "OPENAI_API_KEY", "OPENAI_MODEL", "WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_VAPID_SUBJECT")

$frontendMissing = @()
foreach ($key in @("VITE_API_URL", "VITE_GOOGLE_CLIENT_ID")) {
  if (-not $frontendEnv.ContainsKey($key) -or -not $frontendEnv[$key]) {
    $frontendMissing += $key
  }
}
$frontendPushMissing = @()
if (-not $frontendEnv.ContainsKey("VITE_WEB_PUSH_PUBLIC_KEY") -or -not $frontendEnv["VITE_WEB_PUSH_PUBLIC_KEY"]) {
  $frontendPushMissing += "VITE_WEB_PUSH_PUBLIC_KEY"
}
$backendMissing = @()
if (-not $backendEnv.ContainsKey("CORS_ALLOWED_ORIGINS") -or -not $backendEnv["CORS_ALLOWED_ORIGINS"]) {
  $backendMissing += "CORS_ALLOWED_ORIGINS"
}
if (-not $backendEnv.ContainsKey("ALLOW_LEGACY_PASSWORD_LOGIN") -or $backendEnv["ALLOW_LEGACY_PASSWORD_LOGIN"].ToLowerInvariant() -ne "true") {
  $backendMissing += "ALLOW_LEGACY_PASSWORD_LOGIN=true"
}
$backendPushMissing = @()
foreach ($key in @("WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_VAPID_SUBJECT")) {
  if (-not $backendEnv.ContainsKey($key) -or -not $backendEnv[$key]) {
    $backendPushMissing += $key
  }
}

Write-Output "Frontend env"
foreach ($key in @("VITE_API_URL", "VITE_GOOGLE_CLIENT_ID")) {
  $value = if ($frontendEnv.ContainsKey($key)) { $frontendEnv[$key] } else { "" }
  Write-Output "  $key = $(Mask-Value $value)"
}
foreach ($key in @("VITE_WEB_PUSH_PUBLIC_KEY")) {
  $value = if ($frontendEnv.ContainsKey($key)) { $frontendEnv[$key] } else { "" }
  Write-Output "  $key = $(Mask-Value $value)"
}

Write-Output ""
Write-Output "Backend env"
foreach ($key in @("DATABASE_URL", "APP_ENV", "CORS_ALLOWED_ORIGINS", "ALLOW_LEGACY_PASSWORD_LOGIN")) {
  $value = if ($backendEnv.ContainsKey($key)) { $backendEnv[$key] } else { "" }
  Write-Output "  $key = $(Mask-Value $value)"
}
foreach ($key in @("WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_VAPID_SUBJECT")) {
  $value = if ($backendEnv.ContainsKey($key)) { $backendEnv[$key] } else { "" }
  Write-Output "  $key = $(Mask-Value $value)"
}

Write-Output ""
if ($frontendMissing.Count -eq 0) {
  Write-Output "Frontend login readiness: OK"
} else {
  Write-Output "Frontend login readiness: missing $($frontendMissing -join ', ')"
}
if ($frontendPushMissing.Count -eq 0) {
  Write-Output "Frontend push readiness: OK"
} else {
  Write-Output "Frontend push readiness: missing $($frontendPushMissing -join ', ')"
}

if ($backendMissing.Count -eq 0) {
  Write-Output "Backend session readiness: OK"
} else {
  Write-Output "Backend session readiness: missing $($backendMissing -join ', ')"
}
if ($backendPushMissing.Count -eq 0) {
  Write-Output "Backend push readiness: OK"
} else {
  Write-Output "Backend push readiness: missing $($backendPushMissing -join ', ')"
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

try {
  $response = Invoke-RestMethod -Uri "$apiBaseUrl/api/health" -Method Get -TimeoutSec 8
  Write-Output ""
  Write-Output "Backend /api/health"
  Write-Output "  status = $($response.status)"
  Write-Output "  service = $($response.service)"
} catch {
  Write-Output ""
  Write-Output "Backend /api/health: not reachable at $apiBaseUrl"
  $strictFailures += "API health indisponivel"
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
