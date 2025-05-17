#!/bin/bash
set -e

# ---- Variables ----
RESOURCE_GROUP="auto-poster-rg"
LOCATION="westus3"
STORAGE_ACCOUNT="autoposterstorage$RANDOM"
FUNCTION_APP="auto-poster-function"
RUNTIME="node"
NODE_VERSION="20"

echo "📁 Creating Resource Group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --tags project=linkedin-autoposter owner=derek

echo "📦 Creating Storage Account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --sku Standard_LRS

echo "⚙️ Creating Function App (Consumption Plan)..."
az functionapp create \
  --name $FUNCTION_APP \
  --storage-account $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime $RUNTIME \
  --runtime-version $NODE_VERSION \
  --functions-version 4

echo "✅ Done setting up Azure resources."

echo "🔐 Exporting publish profile (for GitHub Actions)..."
az functionapp deployment list-publishing-profiles \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --output tsv > publishProfile.publishsettings

echo "📄 Saved to publishProfile.publishsettings — upload this to GitHub as a secret!"
