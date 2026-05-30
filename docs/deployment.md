# Deployment

Both apps deploy from GitHub Actions on push to `main`. This guide lists the
one-time Azure setup, the environment configuration, and the secrets the
workflows expect.

## 1. Azure resources

| Resource                | Notes                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Azure Functions App     | Flex Consumption plan, Node 22 runtime. Hosts the `api/` project (timer + HTTP endpoints). |
| Azure OpenAI            | A GPT-4.1 deployment for text. (DALL-E 3 is deprecated on Azure; image generation is off by default.) |
| Blob Storage            | A container for generated images (default `linkedin-images`).                             |
| Cosmos DB               | Database `AutoPoster` with two containers (see below).                                    |
| Azure Static Web Apps   | Free SKU. Hosts the `web/` dashboard; the dashboard calls the Function App directly (CORS). |

### Cosmos DB containers

| Container       | Partition key | Purpose                                            |
| --------------- | ------------- | -------------------------------------------------- |
| `LinkedInPosts` | (your choice) | Archived posts shown in the gallery.               |
| `RateLimits`    | `/id`         | One counter document per UTC day for the dry-run cap. |

### How the dashboard reaches the API

A **Free** Static Web App cannot link a backend (that requires the Standard SKU),
so the dashboard calls the Function App directly. The static export is built with
`NEXT_PUBLIC_API_BASE` set to the Function App URL, and the Function App allows the
Static Web App origin via CORS (`az functionapp cors add`). The `scripts/azure-up.ps1`
script wires this up automatically. If you prefer a same-origin `/api/*` setup,
upgrade the Static Web App to Standard and link the Function App as the backend.

## 2. Function App environment variables

Mirror `api/example.settings.json`. The Phase 2 additions are the last two rows.

| Name                            | Example                                             | Purpose                                  |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| `AZURE_OPENAI_API_KEY_WEST`     | (secret)                                            | Text model key                           |
| `AZURE_OPENAI_ENDPOINT_WEST`    | `https://<res>.openai.azure.com/`                   | Text model endpoint                      |
| `AZURE_OPENAI_API_VERSION_WEST` | `2025-01-01-preview`                                | Text model API version                   |
| `AZURE_OPENAI_GPT_DEPLOYMENT`   | `gpt-5-mini`                                         | Text deployment name                     |
| `AZURE_OPENAI_IMAGE_DEPLOYMENT` | `gpt-image-1`                                        | Image deployment name (if images on)     |
| `AZURE_OPENAI_IMAGE_ENDPOINT`   | `https://<res>.openai.azure.com/`                   | Image endpoint (falls back to WEST)      |
| `AZURE_OPENAI_IMAGE_API_KEY`    | (secret)                                            | Image key (falls back to WEST)           |
| `AZURE_OPENAI_IMAGE_API_VERSION`| `2025-04-01-preview`                                | Image API version                        |
| `AZURE_STORAGE_CONNECTION_STRING` | (secret)                                          | Blob Storage connection                  |
| `AZURE_STORAGE_CONTAINER_NAME`  | `linkedin-images`                                   | Image container                          |
| `COSMOS_ENDPOINT`               | `https://<acct>.documents.azure.com:443/`           | Cosmos endpoint                          |
| `COSMOS_KEY`                    | (secret)                                            | Cosmos key                               |
| `COSMOS_DATABASE_ID`            | `AutoPoster`                                         | Cosmos database                          |
| `COSMOS_LINKEDIN_CONTAINER`     | `LinkedInPosts`                                      | Posts container                          |
| `COSMOS_RATELIMIT_CONTAINER`    | `RateLimits`                                          | Dry-run counter container                |
| `DRYRUN_DAILY_CAP`              | `50`                                                 | Max dry-runs per UTC day (global)        |
| `DRYRUN_PER_IP_HOURLY_CAP`      | `5`                                                  | Max dry-runs per IP per hour             |
| `LINKEDIN_ACCESS_TOKEN`         | (secret)                                            | LinkedIn OAuth token                     |
| `LINKEDIN_MEMBER_URN`           | `urn:li:person:<id>`                                | LinkedIn author URN                      |
| `LINKEDIN_POST_SCHEDULE`        | `0 0 9 * * *`                                        | Timer cron (empty disables the timer)    |
| `ENABLE_IMAGE_GENERATION`       | `false`                                              | Toggle image generation (needs gpt-image-1) |
| `ENABLE_LINKEDIN_POST`          | `true`                                               | Toggle publishing on the timer path      |

For local development, copy `api/example.settings.json` to
`api/local.settings.json` and fill in real values. `local.settings.json` is
gitignored.

## 3. GitHub secrets

| Secret                                                  | Used by              |
| ------------------------------------------------------- | -------------------- |
| `AZUREAPPSERVICE_CLIENTID_*` / `TENANTID_*` / `SUBSCRIPTIONID_*` | API deploy (OIDC login to Azure) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN`                       | Web deploy           |

The API secrets already exist from the original Function App deploy. The Static
Web Apps token is generated when you create the Static Web App; add it as a repo
secret.

## 4. CI/CD

| Workflow                              | Trigger paths                          | Steps (deploy gated on all)            |
| ------------------------------------- | -------------------------------------- | -------------------------------------- |
| `main_auto-poster-function.yml`       | `api/**`, the workflow file            | `npm ci` -> typecheck -> test -> build |
| `web-deploy.yml`                      | `web/**`, the workflow file            | `npm ci` -> test -> build -> SWA deploy |

Path filters mean a frontend-only change does not redeploy the backend and vice
versa.

## 5. After the first deploy

1. Copy the Static Web App URL into the README live-demo link.
2. Verify `GET /api/posts` returns JSON and that the dashboard gallery loads.
3. Trigger the dry-run a couple of times and confirm the remaining-quota count
   decrements and that the cap returns `429` once exhausted.
