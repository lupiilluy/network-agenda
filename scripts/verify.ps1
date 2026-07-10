param()

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Output ""
  Write-Output "==> $Message"
}

$root = Split-Path -Parent $PSScriptRoot

Write-Step "Frontend build"
Push-Location (Join-Path $root "frontend")
try {
  npm run build
} finally {
  Pop-Location
}

Write-Step "Backend tests"
Push-Location (Join-Path $root "backend")
try {
  python -m unittest discover -s tests
} finally {
  Pop-Location
}

Write-Step "Auth readiness"
& (Join-Path $PSScriptRoot "check-auth-readiness.ps1")

Write-Output ""
Write-Output "Verify concluido."
