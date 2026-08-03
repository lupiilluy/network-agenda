param(
  [string]$RenderApiKey = $env:RENDER_API_KEY,
  [string]$RenderServiceName = "network-agenda-api",
  [string]$RenderServiceId = "",
  [string]$VercelToken = $env:VERCEL_TOKEN,
  [string]$FrontendUrl = "",
  [switch]$SkipRenderDeploy,
  [switch]$SkipVercelDeploy
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "frontend"
$backendDir = Join-Path $root "backend"

function Read-EnvFile {
  param([string]$Path)

  $values = @{}
  if (-not (Test-Path $Path)) { return $values }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $parts = $line -split "=", 2
    $values[$parts[0].Trim()] = $parts[1].Trim().Trim("'`"")
  }

  return $values
}

function Read-EnvFiles {
  param([string[]]$Paths)

  $values = @{}
  foreach ($path in $Paths) {
    $fileValues = Read-EnvFile -Path $path
    foreach ($entry in $fileValues.GetEnumerator()) {
      $values[$entry.Key] = $entry.Value
    }
  }

  return $values
}

function First-Defined {
  param(
    [hashtable]$Sources,
    [string[]]$Keys
  )

  foreach ($key in $Keys) {
    if ($Sources.ContainsKey($key) -and $Sources[$key]) {
      return $Sources[$key]
    }
  }
  return ""
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body = $null
  )

  $params = @{
    Method = $Method
    Uri = $Uri
    Headers = $Headers
    TimeoutSec = 30
  }
  if ($null -ne $Body) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
  }
  return Invoke-RestMethod @params
}

function Get-RenderService {
  param(
    [string]$ApiKey,
    [string]$ServiceName,
    [string]$ServiceId
  )

  $headers = @{ Authorization = "Bearer $ApiKey"; Accept = "application/json" }
  if ($ServiceId) {
    return Invoke-JsonRequest -Method Get -Uri "https://api.render.com/v1/services/$ServiceId" -Headers $headers
  }

  $response = Invoke-JsonRequest -Method Get -Uri "https://api.render.com/v1/services?name=$([uri]::EscapeDataString($ServiceName))&type=web_service&limit=20" -Headers $headers
  if (-not $response) {
    throw "Nao foi possivel localizar o service Render '$ServiceName'."
  }

  $matches = @()
  $items = @()
  if ($response.PSObject.Properties.Name -contains "services") {
    $items = @($response.services)
  } elseif ($response -is [System.Array]) {
    $items = @($response)
  } else {
    $items = @($response)
  }

  foreach ($item in $items) {
    $service = if ($item.PSObject.Properties.Name -contains "service") { $item.service } else { $item }
    if ($service -and $service.name -eq $ServiceName) {
      $matches += $service
    }
  }

  if ($matches.Count -eq 0) {
    throw "Nenhum service Render encontrado com nome '$ServiceName'."
  }
  if ($matches.Count -gt 1) {
    throw "Mais de um service Render encontrado com nome '$ServiceName'. Passe -RenderServiceId."
  }

  return $matches[0]
}

function Set-RenderEnvVar {
  param(
    [string]$ApiKey,
    [string]$ServiceId,
    [string]$Key,
    [string]$Value
  )

  if (-not $Value) { return }
  $headers = @{ Authorization = "Bearer $ApiKey"; Accept = "application/json" }
  $encodedKey = [uri]::EscapeDataString($Key)
  Invoke-JsonRequest -Method Put -Uri "https://api.render.com/v1/services/$ServiceId/env-vars/$encodedKey" -Headers $headers -Body @{ value = $Value } | Out-Null
  Write-Output "Render env synced: $Key"
}

function Trigger-RenderDeploy {
  param(
    [string]$ApiKey,
    [string]$ServiceId
  )

  $headers = @{ Authorization = "Bearer $ApiKey"; Accept = "application/json" }
  Invoke-JsonRequest -Method Post -Uri "https://api.render.com/v1/services/$ServiceId/deploys" -Headers $headers -Body @{ clearCache = "do_not_clear"; deployMode = "build_and_deploy" } | Out-Null
  Write-Output "Render deploy triggered."
}

function Get-VercelProject {
  $projectPath = Join-Path $frontendDir ".vercel/project.json"
  if (-not (Test-Path $projectPath)) {
    throw "frontend/.vercel/project.json nao encontrado. Rode `vercel link` no frontend primeiro."
  }
  return Get-Content $projectPath | ConvertFrom-Json
}

function Set-VercelEnvVar {
  param(
    [string]$Token,
    [string]$ProjectId,
    [string]$TeamId,
    [string]$Key,
    [string]$Value,
    [string[]]$Targets
  )

  if (-not $Value) { return }
  $uri = "https://api.vercel.com/v10/projects/$ProjectId/env?upsert=true"
  if ($TeamId) {
    $uri += "&teamId=$TeamId"
  }

  $type = if ($Key -in @("VITE_API_URL", "VITE_SUPABASE_URL", "VITE_GOOGLE_CLIENT_ID", "VITE_GOOGLE_MAPS_API_KEY")) { "plain" } else { "encrypted" }

  $body = @{
    key = $Key
    value = $Value
    type = $type
    target = $Targets
  }

  Invoke-JsonRequest -Method Post -Uri $uri -Headers @{ Authorization = "Bearer $Token"; Accept = "application/json" } -Body $body | Out-Null
  Write-Output "Vercel env synced: $Key"
}

function Get-LocalProductionValues {
  $frontendEnv = Read-EnvFiles -Paths @(
    (Join-Path $frontendDir ".env.local"),
    (Join-Path $frontendDir ".env.production.local")
  )
  $backendEnv = Read-EnvFiles -Paths @(
    (Join-Path $backendDir ".env.local"),
    (Join-Path $backendDir ".env.production.local")
  )

  return @{
    frontend = $frontendEnv
    backend = $backendEnv
  }
}

$local = Get-LocalProductionValues
$frontendEnv = $local.frontend
$backendEnv = $local.backend

if (-not $RenderApiKey) {
  throw "Informe -RenderApiKey ou defina RENDER_API_KEY."
}
if (-not $VercelToken) {
  throw "Informe -VercelToken ou defina VERCEL_TOKEN."
}

$render = Get-RenderService -ApiKey $RenderApiKey -ServiceName $RenderServiceName -ServiceId $RenderServiceId
$renderServiceId = $render.id
$renderServiceUrl = $render.serviceDetails.url
if (-not $renderServiceUrl) {
  $renderServiceUrl = "https://$($render.slug).onrender.com"
}

Write-Output "Render service: $($render.name) [$renderServiceId]"
Write-Output "Render URL: $renderServiceUrl"

$frontendProject = Get-VercelProject
$vercelProjectId = $frontendProject.projectId
$vercelTeamId = $frontendProject.orgId

Write-Output "Vercel project: $($frontendProject.projectName) [$vercelProjectId]"

$frontendTargets = @("production", "preview")

$renderValues = @{
  DATABASE_URL = First-Defined -Sources $backendEnv -Keys @("DATABASE_URL")
  APP_ENV = "production"
  SUPABASE_URL = First-Defined -Sources $backendEnv -Keys @("SUPABASE_URL")
  SUPABASE_JWT_SECRET = First-Defined -Sources $backendEnv -Keys @("SUPABASE_JWT_SECRET")
  ALLOW_LEGACY_PASSWORD_LOGIN = "false"
  OPENAI_API_KEY = First-Defined -Sources $backendEnv -Keys @("OPENAI_API_KEY")
  OPENAI_MODEL = First-Defined -Sources $backendEnv -Keys @("OPENAI_MODEL")
  WEB_PUSH_VAPID_PRIVATE_KEY = First-Defined -Sources $backendEnv -Keys @("WEB_PUSH_VAPID_PRIVATE_KEY")
  WEB_PUSH_VAPID_SUBJECT = First-Defined -Sources $backendEnv -Keys @("WEB_PUSH_VAPID_SUBJECT")
}

if ($FrontendUrl) {
  $renderValues["CORS_ALLOWED_ORIGINS"] = $FrontendUrl
}

foreach ($entry in $renderValues.GetEnumerator()) {
  Set-RenderEnvVar -ApiKey $RenderApiKey -ServiceId $renderServiceId -Key $entry.Key -Value $entry.Value
}

if (-not $SkipRenderDeploy) {
  Trigger-RenderDeploy -ApiKey $RenderApiKey -ServiceId $renderServiceId
}

$vercelValues = @{
  VITE_API_URL = $renderServiceUrl
  VITE_SUPABASE_URL = First-Defined -Sources $frontendEnv -Keys @("VITE_SUPABASE_URL")
  VITE_SUPABASE_ANON_KEY = First-Defined -Sources $frontendEnv -Keys @("VITE_SUPABASE_ANON_KEY")
  VITE_WEB_PUSH_PUBLIC_KEY = First-Defined -Sources $frontendEnv -Keys @("VITE_WEB_PUSH_PUBLIC_KEY")
  VITE_GOOGLE_CLIENT_ID = First-Defined -Sources $frontendEnv -Keys @("VITE_GOOGLE_CLIENT_ID")
  VITE_GOOGLE_MAPS_API_KEY = First-Defined -Sources $frontendEnv -Keys @("VITE_GOOGLE_MAPS_API_KEY")
}

foreach ($entry in $vercelValues.GetEnumerator()) {
  Set-VercelEnvVar -Token $VercelToken -ProjectId $vercelProjectId -TeamId $vercelTeamId -Key $entry.Key -Value $entry.Value -Targets $frontendTargets
}

if (-not $SkipVercelDeploy) {
  $vercelBinary = Get-Command vercel -ErrorAction SilentlyContinue
  $deployCommand = if ($vercelBinary) { "vercel" } else { "npx" }
  $deployArgs = if ($vercelBinary) {
    @("deploy", "--prod", "--yes")
  } else {
    @("vercel", "deploy", "--prod", "--yes")
  }

  Push-Location $frontendDir
  try {
    $env:VERCEL_TOKEN = $VercelToken
    & $deployCommand @deployArgs
  } finally {
    Pop-Location
  }
}

Write-Output ""
Write-Output "Bootstrap concluido."
Write-Output "Se o CORS final ainda nao foi definido, rode novamente com -FrontendUrl https://seu-app.vercel.app"
Write-Output "O script le frontend/.env.local e frontend/.env.production.local, e faz o mesmo no backend."
