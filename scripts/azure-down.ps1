<#
.SYNOPSIS
    Tear down the LinkedIn AI Auto Poster demo to return Azure cost to ~$0.

.DESCRIPTION
    Deletes the entire demo resource group (and everything in it) named in the
    config. Azure OpenAI is referenced, not created by azure-up.ps1, so it lives
    in a different resource group and is NOT touched here.

.PARAMETER ConfigPath
    Path to the JSON config (default: scripts/demo.config.json).

.PARAMETER Force
    Skip the confirmation prompt.

.PARAMETER NoWait
    Return immediately instead of waiting for the delete to finish.

.EXAMPLE
    pwsh ./scripts/azure-down.ps1
#>
[CmdletBinding()]
param(
	[string]$ConfigPath = "$PSScriptRoot/demo.config.json",
	[switch]$Force,
	[switch]$NoWait
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command 'az' -ErrorAction SilentlyContinue)) {
	throw "Azure CLI ('az') not found on PATH. Install: https://aka.ms/azure-cli"
}
if (-not (Test-Path $ConfigPath)) {
	throw "Config not found at '$ConfigPath'."
}
$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($cfg.resourceGroup)) { throw "Config is missing 'resourceGroup'." }
if ([string]::IsNullOrWhiteSpace($cfg.subscriptionId)) { throw "Config is missing 'subscriptionId'." }

$rg = $cfg.resourceGroup
& az account set --subscription $cfg.subscriptionId | Out-Null

$exists = (& az group exists -n $rg)
if ($exists -ne 'true') {
	Write-Host "Resource group '$rg' does not exist. Nothing to tear down." -ForegroundColor Yellow
	return
}

Write-Host "This will permanently delete resource group '$rg' and ALL resources in it." -ForegroundColor Red
Write-Host "(Your referenced Azure OpenAI resource is in a different group and is not affected.)" -ForegroundColor DarkGray

if (-not $Force) {
	$answer = Read-Host "Type the resource group name to confirm"
	if ($answer -ne $rg) {
		Write-Host 'Confirmation did not match. Aborting.' -ForegroundColor Yellow
		return
	}
}

$delArgs = @('group', 'delete', '-n', $rg, '--yes')
if ($NoWait) { $delArgs += '--no-wait' }
& az @delArgs
if ($LASTEXITCODE -ne 0) { throw "Failed to delete resource group '$rg'." }

if ($NoWait) {
	Write-Host "`nDeletion started for '$rg'. Cost stops accruing as resources are removed." -ForegroundColor Green
}
else {
	Write-Host "`nResource group '$rg' deleted. Demo cost is back to ~`$0." -ForegroundColor Green
}
