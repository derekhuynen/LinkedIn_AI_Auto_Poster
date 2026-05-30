<#
.SYNOPSIS
    Stand up the LinkedIn AI Auto Poster demo on Azure, cheaply.

.DESCRIPTION
    Provisions a single resource group containing low/zero-idle-cost services
    (Consumption Function App, serverless Cosmos DB, Standard storage, Free
    Static Web App), wires up settings, deploys both apps, and seeds the gallery.

    The demo runs with the timer and LinkedIn posting DISABLED, so it never
    auto-posts to your real LinkedIn. Only the rate-capped /api/preview dry-run
    calls OpenAI. Tear everything down with azure-down.ps1 to return cost to ~$0.

    Azure OpenAI is referenced from config, not created, so it is left untouched.

.PARAMETER ConfigPath
    Path to the JSON config (default: scripts/demo.config.json). Copy
    demo.config.example.json and fill it in.

.PARAMETER SkipDeploy
    Provision and configure only; skip building/deploying app code and seeding.

.EXAMPLE
    pwsh ./scripts/azure-up.ps1
#>
[CmdletBinding()]
param(
	[string]$ConfigPath = "$PSScriptRoot/demo.config.json",
	[switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Info($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }

function Assert-Command($name, $hint) {
	if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
		throw "Required tool '$name' not found on PATH. $hint"
	}
}

# Runs a native command and throws on non-zero exit. Captures stdout for return.
function Invoke-Native {
	param([string]$Exe, [string[]]$Args, [switch]$Quiet)
	if (-not $Quiet) { Write-Info "$Exe $($Args -join ' ')" }
	$output = & $Exe @Args
	if ($LASTEXITCODE -ne 0) {
		throw "Command failed ($LASTEXITCODE): $Exe $($Args -join ' ')"
	}
	return $output
}

# --- Load and validate config -------------------------------------------------

if (-not (Test-Path $ConfigPath)) {
	throw "Config not found at '$ConfigPath'. Copy scripts/demo.config.example.json to scripts/demo.config.json and fill it in."
}
$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json

foreach ($req in @('subscriptionId', 'location', 'swaLocation', 'resourceGroup', 'namePrefix')) {
	if ([string]::IsNullOrWhiteSpace($cfg.$req)) { throw "Config is missing '$req'." }
}
foreach ($req in @('endpointWest', 'apiKeyWest', 'gptDeployment', 'endpointEast', 'apiKeyEast', 'dalleDeployment')) {
	if ([string]::IsNullOrWhiteSpace($cfg.openai.$req)) { throw "Config is missing 'openai.$req'." }
}

$dryRunCap = if ($cfg.dryRunDailyCap) { [int]$cfg.dryRunDailyCap } else { 50 }
$seedGallery = $true
if ($null -ne $cfg.seedGallery) { $seedGallery = [bool]$cfg.seedGallery }

# --- Prerequisites ------------------------------------------------------------

Write-Step 'Checking prerequisites'
Assert-Command 'az'   'Install the Azure CLI: https://aka.ms/azure-cli'
Assert-Command 'node' 'Install Node.js 20+: https://nodejs.org'
Assert-Command 'npm'  'Install Node.js 20+ (npm ships with it).'
if (-not $SkipDeploy) {
	Assert-Command 'func' 'Install Azure Functions Core Tools: https://aka.ms/func-core-tools'
}
try { Invoke-Native 'az' @('account', 'show', '-o', 'none') -Quiet | Out-Null }
catch { throw "Not logged in to Azure. Run 'az login' first." }

Invoke-Native 'az' @('account', 'set', '--subscription', $cfg.subscriptionId) | Out-Null

# --- Deterministic resource names (idempotent across re-runs) ------------------

$sha = [System.Security.Cryptography.SHA1]::Create()
$bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("$($cfg.subscriptionId)/$($cfg.resourceGroup)"))
$suffix = ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLower().Substring(0, 5)

$prefix       = $cfg.namePrefix.ToLower()
$rg           = $cfg.resourceGroup
$storageName  = "$prefix" + 'st' + $suffix      # 3-24 lowercase alphanumeric
$cosmosName   = "$prefix-cosmos-$suffix"
$funcName     = "$prefix-func-$suffix"
$swaName      = "$prefix-web-$suffix"
$dbName       = 'AutoPoster'
$postsCtr     = 'LinkedInPosts'
$rateCtr      = 'RateLimits'
$blobCtr      = 'linkedin-images'

Write-Step 'Resource plan'
Write-Info "resource group : $rg ($($cfg.location))"
Write-Info "storage        : $storageName"
Write-Info "cosmos (serverless): $cosmosName"
Write-Info "function app   : $funcName"
Write-Info "static web app : $swaName ($($cfg.swaLocation))"

# --- Resource group -----------------------------------------------------------

Write-Step 'Creating resource group'
Invoke-Native 'az' @('group', 'create', '-n', $rg, '-l', $cfg.location, '-o', 'none') | Out-Null

# --- Storage ------------------------------------------------------------------

Write-Step 'Creating storage account'
Invoke-Native 'az' @('storage', 'account', 'create', '-n', $storageName, '-g', $rg, '-l', $cfg.location,
	'--sku', 'Standard_LRS', '--kind', 'StorageV2', '-o', 'none') | Out-Null
$storageConn = (Invoke-Native 'az' @('storage', 'account', 'show-connection-string', '-n', $storageName, '-g', $rg,
	'--query', 'connectionString', '-o', 'tsv') -Quiet).Trim()

# --- Cosmos DB (serverless) ---------------------------------------------------

Write-Step 'Creating Cosmos DB (serverless) + containers'
Invoke-Native 'az' @('cosmosdb', 'create', '-n', $cosmosName, '-g', $rg,
	'--capabilities', 'EnableServerless', '--default-consistency-level', 'Session', '-o', 'none') | Out-Null
Invoke-Native 'az' @('cosmosdb', 'sql', 'database', 'create', '-a', $cosmosName, '-g', $rg, '-n', $dbName, '-o', 'none') | Out-Null
foreach ($ctr in @($postsCtr, $rateCtr)) {
	Invoke-Native 'az' @('cosmosdb', 'sql', 'container', 'create', '-a', $cosmosName, '-g', $rg,
		'-d', $dbName, '-n', $ctr, '--partition-key-path', '/id', '-o', 'none') | Out-Null
}
$cosmosKey = (Invoke-Native 'az' @('cosmosdb', 'keys', 'list', '-n', $cosmosName, '-g', $rg,
	'--query', 'primaryMasterKey', '-o', 'tsv') -Quiet).Trim()
$cosmosEndpoint = "https://$cosmosName.documents.azure.com:443/"

# --- Function App -------------------------------------------------------------

Write-Step 'Creating Function App (Linux, Consumption, Node 20)'
Invoke-Native 'az' @('functionapp', 'create', '-n', $funcName, '-g', $rg,
	'--storage-account', $storageName, '--consumption-plan-location', $cfg.location,
	'--runtime', 'node', '--runtime-version', '20', '--functions-version', '4',
	'--os-type', 'Linux', '-o', 'none') | Out-Null

Write-Step 'Applying Function App settings'
$settings = @(
	"AZURE_OPENAI_API_KEY_WEST=$($cfg.openai.apiKeyWest)",
	"AZURE_OPENAI_ENDPOINT_WEST=$($cfg.openai.endpointWest)",
	"AZURE_OPENAI_API_VERSION_WEST=$(if ($cfg.openai.apiVersionWest) { $cfg.openai.apiVersionWest } else { '2025-01-01-preview' })",
	"AZURE_OPENAI_GPT_DEPLOYMENT=$($cfg.openai.gptDeployment)",
	"AZURE_OPENAI_API_KEY_EAST=$($cfg.openai.apiKeyEast)",
	"AZURE_OPENAI_ENDPOINT_EAST=$($cfg.openai.endpointEast)",
	"AZURE_OPENAI_API_VERSION_EAST=$(if ($cfg.openai.apiVersionEast) { $cfg.openai.apiVersionEast } else { '2024-02-01' })",
	"AZURE_OPENAI_DALLE_DEPLOYMENT=$($cfg.openai.dalleDeployment)",
	"AZURE_STORAGE_CONNECTION_STRING=$storageConn",
	"AZURE_STORAGE_CONTAINER_NAME=$blobCtr",
	"COSMOS_ENDPOINT=$cosmosEndpoint",
	"COSMOS_KEY=$cosmosKey",
	"COSMOS_DATABASE_ID=$dbName",
	"COSMOS_LINKEDIN_CONTAINER=$postsCtr",
	"COSMOS_RATELIMIT_CONTAINER=$rateCtr",
	"DRYRUN_DAILY_CAP=$dryRunCap",
	"LINKEDIN_ACCESS_TOKEN=$($cfg.linkedin.accessToken)",
	"LINKEDIN_MEMBER_URN=$($cfg.linkedin.memberUrn)",
	# Demo safety: no timer, no LinkedIn publishing. Images still generate for the dry-run.
	'LINKEDIN_POST_SCHEDULE=',
	'ENABLE_LINKEDIN_POST=false',
	'ENABLE_IMAGE_GENERATION=true'
)
Invoke-Native 'az' (@('functionapp', 'config', 'appsettings', 'set', '-n', $funcName, '-g', $rg, '-o', 'none', '--settings') + $settings) | Out-Null

# --- Static Web App -----------------------------------------------------------

Write-Step 'Creating Static Web App (Free) and linking the backend'
Invoke-Native 'az' @('staticwebapp', 'create', '-n', $swaName, '-g', $rg, '-l', $cfg.swaLocation, '--sku', 'Free', '-o', 'none') | Out-Null
$funcId = (Invoke-Native 'az' @('functionapp', 'show', '-n', $funcName, '-g', $rg, '--query', 'id', '-o', 'tsv') -Quiet).Trim()
Invoke-Native 'az' @('staticwebapp', 'backends', 'link', '-n', $swaName, '-g', $rg,
	'--backend-resource-id', $funcId, '--backend-region', $cfg.location, '-o', 'none') | Out-Null

# --- Deploy code + seed -------------------------------------------------------

if (-not $SkipDeploy) {
	Write-Step 'Building and deploying the API (func publish)'
	Push-Location (Join-Path $repoRoot 'api')
	try {
		Invoke-Native 'npm' @('ci')
		Invoke-Native 'npm' @('run', 'build')
		Invoke-Native 'func' @('azure', 'functionapp', 'publish', $funcName)
	}
	finally { Pop-Location }

	Write-Step 'Building and deploying the web dashboard'
	Push-Location (Join-Path $repoRoot 'web')
	try {
		$env:NEXT_PUBLIC_USE_SAMPLE_DATA = 'false'   # real API via same-origin linked backend
		Invoke-Native 'npm' @('ci')
		Invoke-Native 'npm' @('run', 'build')
		$swaToken = (Invoke-Native 'az' @('staticwebapp', 'secrets', 'list', '-n', $swaName, '-g', $rg,
			'--query', 'properties.apiKey', '-o', 'tsv') -Quiet).Trim()
		Invoke-Native 'npx' @('-y', '@azure/static-web-apps-cli', 'deploy', 'out',
			'--deployment-token', $swaToken, '--env', 'production')
	}
	finally {
		Remove-Item Env:NEXT_PUBLIC_USE_SAMPLE_DATA -ErrorAction SilentlyContinue
		Pop-Location
	}

	if ($seedGallery) {
		Write-Step 'Seeding the gallery with sample posts'
		Push-Location (Join-Path $repoRoot 'api')
		try {
			$env:COSMOS_ENDPOINT = $cosmosEndpoint
			$env:COSMOS_KEY = $cosmosKey
			$env:COSMOS_DATABASE_ID = $dbName
			$env:COSMOS_LINKEDIN_CONTAINER = $postsCtr
			Invoke-Native 'node' @((Join-Path $PSScriptRoot 'seed-cosmos.mjs'))
		}
		finally {
			'COSMOS_ENDPOINT', 'COSMOS_KEY', 'COSMOS_DATABASE_ID', 'COSMOS_LINKEDIN_CONTAINER' |
				ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
			Pop-Location
		}
	}
}

# --- Summary ------------------------------------------------------------------

$swaHost = (Invoke-Native 'az' @('staticwebapp', 'show', '-n', $swaName, '-g', $rg,
	'--query', 'defaultHostname', '-o', 'tsv') -Quiet).Trim()

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host ' Demo is up.' -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Live demo URL : https://$swaHost"
Write-Host " Function App  : $funcName"
Write-Host " Resource group: $rg"
if ($SkipDeploy) { Write-Host ' (Infra only: code was not deployed. Re-run without -SkipDeploy or push to deploy.)' -ForegroundColor Yellow }
Write-Host "`n Paste the URL into the README live-demo placeholder." -ForegroundColor Yellow
Write-Host " Tear it all down with: pwsh ./scripts/azure-down.ps1`n" -ForegroundColor Yellow
