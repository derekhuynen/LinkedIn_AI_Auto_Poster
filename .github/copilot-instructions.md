# Copilot Instructions for LinkedIn AI Auto Poster

## Project context

A two-app monorepo:

- **`api/`** an Azure Functions app (TypeScript, v4 programming model) that runs an
  AI content pipeline on a timer and exposes two anonymous HTTP endpoints.
- **`web/`** a Next.js (App Router) dashboard, static-exported to Azure Static Web Apps.

The pipeline lives in `api/src/flow/linkedin_post_flow.ts`; the timer trigger is
`api/src/functions/auto_post.ts`; the HTTP endpoints are `get_posts.ts` and
`generate_preview.ts`.

**Models:** `gpt-5-mini` for topic/post/image-prompt text (a reasoning model — calls
send `reasoning_effort: 'low'`), and `gpt-image-1` for cover images (returns base64).

## Conventions

- **TypeScript strict** in both apps; avoid `any` unless justified (the caught-error
  logging pattern is the accepted exception).
- **Env-driven config.** Read all secrets/config from environment variables; never
  hardcode. Local dev uses `api/local.settings.json` (gitignored).
- **Thin triggers.** Keep Azure Function handlers thin; business logic lives in
  `api/src/flow` and `api/src/service`.
- **Retries.** Wrap external calls with `withRetry(fn, retries, context, opName)` from
  `api/src/service/retryUtil.ts` (exponential backoff + jitter).
- **Graceful degradation.** Image-generation failures must not break the post flow.
- **Tests.** Vitest in both apps; mock Azure/OpenAI SDK clients so tests are hermetic.
  The flow tests assert the dry-run never posts/persists.

## The pipeline (`linkedInPostFlow`)

Driven by an options object `{ triggerBy, post, persist, generateImage }` so the same
code serves the scheduled run and the public dry-run:

1. Query recent posts from Cosmos DB to avoid repeating topics.
2. Generate a topic with `gpt-5-mini` (JSON, validated by a type guard).
3. Generate the post body and the image prompt in parallel.
4. If `generateImage`: generate a cover with `gpt-image-1`, upload bytes to Blob Storage.
5. If `post`: publish to LinkedIn (image asset + text).
6. If `persist`: archive the run to Cosmos DB.

The public `POST /api/preview` calls this with `post: false, persist: false` behind a
rate limiter (`RateLimitService`: global daily cap + per-IP hourly cap, Cosmos counters
with ETag concurrency).

## Do not

- Commit secrets, credentials, or `local.settings.json` / `scripts/demo.config.json`.
- Hardcode config instead of using environment variables.
- Put business logic in Azure Function trigger files.
- Skip retry/error handling on external calls.
- Let the public dry-run publish to LinkedIn or persist to the gallery.

## Reference docs

- [docs/architecture.md](../docs/architecture.md) — data flow and design.
- [docs/deployment.md](../docs/deployment.md) — Azure setup and env vars.
