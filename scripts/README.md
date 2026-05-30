# Demo provisioning scripts

Stand the demo up on Azure for as long as you need it, then tear it down so idle
cost returns to roughly **$0**. Everything lives in one resource group; teardown
deletes the group.

## Cost posture

| Service              | Plan               | Idle cost          |
| -------------------- | ------------------ | ------------------ |
| Function App         | Consumption        | ~$0 (pay per run)  |
| Cosmos DB            | Serverless         | ~$0 (pay per RU)   |
| Static Web App       | Free               | $0                 |
| Storage              | Standard LRS       | pennies/month      |

The only real spend is **Azure OpenAI per `/api/preview` dry-run**, capped at
`DRYRUN_DAILY_CAP` per day (default 50). The deployed demo runs with the **timer
and LinkedIn posting disabled**, so it never auto-posts to your real LinkedIn.

Azure OpenAI is **referenced, not created** (it is quota-gated and you already
have it). It lives in a separate resource group and is never touched by these
scripts.

## Prerequisites

- [Azure CLI](https://aka.ms/azure-cli) (`az`), logged in: `az login`
- [Node.js 20+](https://nodejs.org)
- [Azure Functions Core Tools](https://aka.ms/func-core-tools) (`func`) for code deploy

## Setup

1. Copy the config template and fill it in (it holds secrets and is gitignored):

   ```bash
   cp scripts/demo.config.example.json scripts/demo.config.json
   ```

   Set your `subscriptionId`, a `resourceGroup` name, and your existing Azure
   OpenAI endpoint/keys. LinkedIn fields can stay empty (the demo does not post).

2. Stand it up (provision + configure + deploy + seed the gallery):

   ```powershell
   pwsh ./scripts/azure-up.ps1
   ```

   When it finishes it prints the live demo URL. Paste that into the README
   live-demo placeholder.

3. Tear it down when you are done:

   ```powershell
   pwsh ./scripts/azure-down.ps1
   ```

## Scripts

| Script              | What it does                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| `azure-up.ps1`      | Provisions the resource group and all services, sets app settings, deploys both apps, links the SWA backend, and seeds the gallery. `-SkipDeploy` provisions only. |
| `azure-down.ps1`    | Deletes the demo resource group. Prompts for confirmation; `-Force` skips it, `-NoWait` returns immediately. |
| `seed-cosmos.mjs`   | Inserts a few sample posts so the gallery looks populated. Called by `azure-up.ps1`; can be run standalone with the `COSMOS_*` env vars set. |

Resource names are derived deterministically from your subscription + resource
group, so re-running `azure-up.ps1` targets the same resources (idempotent).
