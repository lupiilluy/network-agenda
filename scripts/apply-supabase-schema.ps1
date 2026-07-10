param(
  [string]$DatabaseUrl = "",
  [switch]$Seed
)

$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "apply-supabase-schema.py"

if (-not $DatabaseUrl) {
  if ($env:DATABASE_URL) {
    $DatabaseUrl = $env:DATABASE_URL
  }
}

if (-not $DatabaseUrl) {
  throw "Informe -DatabaseUrl ou defina DATABASE_URL."
}

$args = @("--database-url", $DatabaseUrl)
if ($Seed) {
  $args += "--seed"
}

python $script @args
