param(
  [string]$ApiBaseUrl = "",
  [string]$VercelUrl = "",
  [switch]$SkipBuild,
  [switch]$SkipStrictReadiness,
  [switch]$RunSmokeTest
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Output ""
  Write-Output "==> $Message"
}

function Test-Command {
  param(
    [string]$Name,
    [scriptblock]$Script
  )
  Write-Step $Name
  & $Script
}

Write-Output "Network Intelligence CRM go-live"
Write-Output "Sequencia recomendada:"
Write-Output "1. Validar build e testes locais."
Write-Output "2. Validar readiness de auth/push/graph."
Write-Output "3. Publicar backend no Render."
Write-Output "4. Publicar frontend no Vercel."
Write-Output "5. Rodar smoke test contra as URLs publicadas."

$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "frontend"
$backendDir = Join-Path $root "backend"
$authCheck = Join-Path $PSScriptRoot "check-auth-readiness.ps1"

if (-not $SkipBuild) {
  Test-Command -Name "Frontend build" -Script {
    Push-Location $frontendDir
    try {
      npm run build
    } finally {
      Pop-Location
    }
  }

  Test-Command -Name "Backend tests" -Script {
    Push-Location $backendDir
    try {
      python -m py_compile app\main.py app\database.py app\schemas.py
      python -m unittest discover -s tests
    } finally {
      Pop-Location
    }
  }
}

if (-not $SkipStrictReadiness) {
  Test-Command -Name "Readiness check" -Script {
    & $authCheck -Strict
  }
}

if ($RunSmokeTest) {
  if (-not $ApiBaseUrl) {
    throw "Informe -ApiBaseUrl para smoke test remoto."
  }

  $normalizedApi = $ApiBaseUrl.TrimEnd("/")
  Test-Command -Name "Smoke test API" -Script {
    $health = Invoke-RestMethod -Uri "$normalizedApi/api/health" -Method Get -TimeoutSec 10
    $auth = Invoke-RestMethod -Uri "$normalizedApi/api/auth/status" -Method Get -TimeoutSec 10
    $graph = Invoke-RestMethod -Uri "$normalizedApi/api/graph?scope=public" -Method Get -TimeoutSec 10
    Write-Output "health: $($health.status)"
    Write-Output "auth: production_ready=$($auth.production_auth_ready) rls_ready=$($auth.rls_ready) fallback=$($auth.demo_fallback_enabled)"
    Write-Output "graph: nodes=$($graph.nodes.Count) edges=$($graph.edges.Count)"
    if (-not $auth.production_auth_ready -or -not $auth.rls_ready -or $auth.demo_fallback_enabled) {
      throw "Smoke test falhou: auth readiness invalida."
    }
  }
}

if ($VercelUrl) {
  Write-Step "Pendencia manual"
  Write-Output "Vercel URL informada: $VercelUrl"
  Write-Output "Confirme estas variaveis no projeto frontend:"
  Write-Output "  VITE_API_URL=$ApiBaseUrl"
  Write-Output "  VITE_SUPABASE_URL=<supabase-url>"
  Write-Output "  VITE_SUPABASE_ANON_KEY=<anon-key>"
  Write-Output "  VITE_WEB_PUSH_PUBLIC_KEY=<vapid-public-key>"
}

Write-Step "Encerramento"
Write-Output "Se os checks acima passaram, o go-live esta pronto para validacao final manual."
