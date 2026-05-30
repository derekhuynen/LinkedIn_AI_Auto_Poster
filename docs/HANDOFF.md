# Handoff / Current State

_Last updated: 2026-05-30._

A snapshot of where the project stands so a new contributor (or agent) can pick up
without re-deriving context. For how it works see [architecture.md](architecture.md);
for how to deploy see [deployment.md](deployment.md).

## What this is

A two-app monorepo: `api/` (Azure Functions, TypeScript) runs an AI content
pipeline; `web/` (Next.js static export) is a dashboard. The repo is a portfolio
showcase aimed at recruiters, with a live demo.

## Live demo

- **URL:** https://zealous-water-0f40a230f.7.azurestaticapps.net
- The gallery is seeded from pre-saved example posts (`web/lib/examples.json` +
  `web/public/samples/*.png`); the dry-run generates a real post and cover image on
  demand and never posts to LinkedIn.

## Deployed Azure resources (cost-controlled demo)

All in resource group **`linkedin-ai-demo-rg`** (eastus; SWA in eastus2):

| Resource | Name | Notes |
| --- | --- | --- |
| Function App | `liaidemo-func-d5ad3` | **Flex Consumption**, Node 22 (Y1 + Node 24 would not start) |
| Cosmos DB | `liaidemo-cosmos-d5ad3` | Serverless; db `AutoPoster`; containers `LinkedInPosts`, `RateLimits` (TTL on, PK `/id`) |
| Storage | `liaidemostd5ad3` | Standard LRS; **blob public access enabled** (so the dashboard can load cover images by URL) |
| Static Web App | `liaidemo-web-d5ad3` | **Free**; calls the API cross-origin via CORS (Free cannot link a backend) |

**Azure OpenAI** is separate: resource **`dh-ai-img-sc2`** (RG `dh-ai-image-rg`,
**swedencentral**), an AIServices resource hosting **both** `gpt-5-mini` (text) and
`gpt-image-1` (image). It is NOT in the demo group, so `azure-down.ps1` does not touch it.
(`gpt-image-1` is region-limited, which is why everything lives in swedencentral. The
empty `dh-ai-foundry-east-2` in eastus2 is unused and can be deleted.)

**Teardown:** `pwsh ./scripts/azure-down.ps1` deletes `linkedin-ai-demo-rg` -> ~$0.
The `dh-ai-img-sc2` deployments survive teardown (pay-per-use, no idle cost).

## Models

- **Text: `gpt-5-mini`** (live). It is a reasoning model, so `OpenAiService` sends
  `reasoning_effort: 'low'` and `max_completion_tokens: 2000` (lower budgets returned
  empty posts because reasoning tokens consumed them). Deployment capacity is 50K TPM
  (10K throttled the two parallel calls the flow makes when images are on).
- **Image: `gpt-image-1`** (live, `ENABLE_IMAGE_GENERATION=true`). Returns base64 ->
  decoded to a Buffer -> uploaded to Blob Storage -> public URL. Defaults are **low
  quality / 1024x1024** on purpose: high quality made the synchronous dry-run take ~77s,
  which exceeded the gateway window and the long response came back without the CORS
  header (browser failed; curl did not). Low/square keeps the request ~15-25s and is
  cheaper. Raise `LINKEDIN_IMAGE_DEFAULTS` for the timer path if you want richer images.
- **Gotchas learned:** image/flagship models are RTFP-gated (`715-123420`) and unblock
  after a clean single attempt from a fresh resource group; the storage account needs
  `--allow-blob-public-access true` or the blob upload fails with "Public access is not
  permitted".

## CI/CD

- Workflows: `main_auto-poster-function.yml` (api), `web-deploy.yml` (web), `codeql.yml`.
- **Deploys are gated to `workflow_dispatch`** so every push stays green on build/test
  (the CI deploy credentials are not wired: the API OIDC app registration is stale, and
  the SWA `AZURE_STATIC_WEB_APPS_API_TOKEN` secret is not set). The demo is deployed via
  `scripts/azure-up.ps1`, not CI.
- Dependabot (api/web/actions) and CodeQL are active.

## Tests

- `api/`: 23 Vitest tests (`cd api && npm test`). Includes the proof that a dry-run
  never posts/persists, and the rate-limiter cannot be overspent.
- `web/`: 24 Vitest unit tests + 3 Playwright E2E (`cd web && npm test`, `npm run e2e`).

## Git / auth

- Remote `origin` uses the SSH alias **`git@github.com-derekhuynen:...`** (the `gh` CLI is
  logged in as `koduhai`, which cannot push to `derekhuynen`'s repo; SSH key for
  `derekhuynen` is configured in `~/.ssh/config`). Push with `git push origin main`.
- `main` is pushed and in sync with origin.

## Open items (owner)

- Wire CI deploys if desired: recreate the API OIDC app registration + secrets, and add
  the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret; then deploys can run on push instead of
  manual dispatch.
- To refresh the gallery examples, edit `web/lib/examples.json` (+ matching images in
  `web/public/samples/`) and run `node scripts/seed-cosmos.mjs` with the Cosmos env set.
