# LinkedIn AI Auto Poster: Showcase Upgrade Design

**Date:** 2026-05-29
**Status:** Approved
**Audience for the upgraded project:** Hiring managers / recruiters
**Scope:** Full showcase

## Goal

Turn a functional-but-rough Azure Functions side project into a portfolio-grade
demo that signals strong engineering to a recruiter within seconds, and stands up
to a technical reviewer reading the code. The upgrade adds a public live demo,
real test coverage, strict typing, accurate docs, and visible proof the system
runs in production.

The bones are already good (clean service/flow layering, retry logic, Azure
integration, feature flags). This is a focused upgrade, not a rewrite.

## Success criteria

- A recruiter can click a **live demo link** in the README and interact with the
  project (browse generated posts, trigger a safe live generation).
- The GitHub repo reads as polished: accurate README, architecture diagram,
  screenshots, passing-CI badge, real tests.
- The codebase is TypeScript `strict: true` with no unjustified `any`.
- The public demo provably cannot post to LinkedIn or run up unbounded cost.
- Every command and instruction in the docs actually works against the repo.

## Key decisions (settled during brainstorming)

| Decision | Choice |
| --- | --- |
| Recruiter experience | Polished GitHub repo **and** a live deployed demo, linked from README |
| Demo interactivity | Read-only gallery **plus** a live, rate-capped dry-run (never posts) |
| Frontend stack / hosting | Next.js (App Router) + TypeScript + Tailwind on Azure Static Web Apps |
| Frontend ↔ backend wiring | **Linked backend**: SWA links to the existing Function App; `/api/*` proxied same-origin |
| Cost/abuse protection | **Global daily cap** on dry-runs (default 50/day), tracked in Cosmos |
| Test framework | Vitest (backend + frontend) |
| Monorepo tooling | None; plain two-folder layout (`api/`, `web/`) |

## Repository structure

Rename the existing app folder for a clear two-app story, add the frontend.

```
LinkedIn_AI_Auto_Poster/
├── README.md                      # rewritten: badges, live demo link, diagram, screenshots
├── LICENSE                        # NEW: MIT (matches declared license)
├── docs/
│   ├── architecture.md            # Mermaid diagram + data-flow walkthrough
│   ├── deployment.md              # step-by-step Azure + secrets checklist
│   └── superpowers/specs/         # this design doc
├── api/                           # renamed from linkedin_ai_auto_poster/ (Azure Function App)
│   ├── src/
│   │   ├── flow/linkedin_post_flow.ts      # refactored to options-object mode
│   │   ├── functions/
│   │   │   ├── auto_post.ts                 # existing timer trigger
│   │   │   ├── get_posts.ts                 # NEW: GET /api/posts
│   │   │   ├── generate_preview.ts          # NEW: POST /api/preview
│   │   │   └── test_*.ts                     # existing test endpoints
│   │   ├── service/                         # existing services, strict-mode cleaned
│   │   └── ...
│   ├── tests/                               # NEW: Vitest unit tests
│   └── tsconfig.json                        # strict: true
├── web/                           # NEW: Next.js dashboard (Azure Static Web Apps)
│   ├── app/
│   ├── components/
│   └── tests/
└── .github/workflows/
    ├── api-deploy.yml             # existing deploy, path-renamed, real test gate
    └── web-deploy.yml             # NEW: Static Web Apps deploy
```

The rename `linkedin_ai_auto_poster/` -> `api/` costs a one-time path update in the
existing workflow and README. No workspace tooling (Turborepo/npm-workspaces): the
two apps deploy independently and a tool would add config overhead without payoff.

## Backend design (`api/`)

### New endpoint: `GET /api/posts` (gallery feed)

- Reads recent posts from Cosmos, newest first, paginated via `?limit=` and
  `?continuationToken=`. Reuses existing `CosmosService.queryItemsWithPagination`.
- Returns a **trimmed, public-safe shape** only: `topic`, `topicDescription`,
  `linkedInPost`, `blobStorageUrl` (durable image, not the expiring DALL-E URL),
  `createdAt`, `triggerBy`. No secrets, no internal fields.
- `authLevel: anonymous`, read-only.

### New endpoint: `POST /api/preview` (rate-capped live dry-run)

- Runs the generation pipeline (topic -> post -> image) but **hard-stops before
  LinkedIn**: calls neither `postToLinkedIn` nor `uploadImageToLinkedIn`.
- Refactor `linkedInPostFlow` to take an explicit options object
  `{ post: boolean, persist: boolean }`, making dry-run a first-class,
  type-enforced mode instead of relying on scattered env-var flags:
  - Timer path passes `{ post: true, persist: true }`.
  - Preview path passes `{ post: false, persist: false }`.
- **Global daily cap:** before generating, atomically increment a counter doc in
  Cosmos keyed by date (id `dryrun-counter-YYYY-MM-DD`). If today's count exceeds
  the cap (env `DRYRUN_DAILY_CAP`, default 50), return `429` with
  `{ error, resetsAt }` and generate nothing. Uses Cosmos optimistic concurrency
  (ETag) so concurrent clicks cannot overspend.
- Dry-run results are returned to the browser and **not persisted** to the main
  posts feed, keeping the gallery an honest record of real auto-posted history.
- Response includes generated `topic`, `linkedInPost`, image URL, and remaining
  daily quota.

### Quality pass on existing code

- `tsconfig.json`: `strict: false` -> **`strict: true`**; resolve resulting `any`s
  (`catch (error: any)` -> `unknown` with narrowing; type guard and Cosmos query
  options get real types).
- Bump TypeScript `^4` -> `^5`; drop deprecated `@types/axios` stub (axios ships
  its own types).
- Replace hardcoded fallback endpoints in `OpenAiService.generateImage` with
  required-env-var validation (fail fast, matching the constructor), so the code is
  not tied to one person's Azure resource URLs.
- Fix `CosmosService.setContainer`'s untyped `process.env.COSMOS_DATABASE_ID` once
  strict is on.

## Frontend design (`web/`)

Single polished page. Next.js App Router + TypeScript, React Server Components for
the gallery fetch, a small client component for the dry-run. Tailwind CSS. Deployed
to Azure Static Web Apps, linked to the Function App so `/api/*` is same-origin (no
CORS, no exposed keys). The `frontend-design` skill is used during implementation to
avoid a generic AI look: clean, restrained, professional.

Layout, top to bottom:

1. **Hero** — title, one-line pitch, tech badges (Azure Functions, OpenAI GPT-4.1,
   DALL-E 3, Cosmos DB, Next.js), "View source on GitHub" link.
2. **Live dry-run panel** — "Generate a sample post" button. On click: calls
   `POST /api/preview`, shows loading, then renders the generated post text + image
   as a LinkedIn-style card. Shows "X demo generations left today." Handles `429`
   gracefully ("Daily demo limit reached, resets at midnight UTC"). Caption: "This
   is a preview, nothing is posted to LinkedIn."
3. **Gallery feed** — server-rendered grid of real past auto-posts from
   `GET /api/posts`: image thumbnail, topic, truncated post text, date. "Load more"
   uses the continuation token.
4. **Footer** — architecture summary line + links.

States handled explicitly: gallery loading skeletons, empty state, API-error state,
and the dry-run cap-reached state.

Deliberately one page: no auth, no multi-route dashboard (YAGNI).

## Testing strategy

**Framework:** Vitest. Mock Azure/OpenAI SDK clients so tests are hermetic (no
network, no real keys, CI-safe).

**Backend unit tests:**

- `retryUtil`: succeeds first try; succeeds after N failures; exhausts retries and
  throws last error; respects retry count.
- `isGenerateTopicPromptResponse`: accepts valid; rejects each missing/wrong-typed
  field.
- `BlobStorageService.getContentType`: extension -> MIME mapping incl. default.
- `linkedInPostFlow` with mocked services (the key guarantee): `{ post: false }`
  never calls `postToLinkedIn`/`uploadImageToLinkedIn`; `{ persist: false }` never
  calls `createItem`; timer path `{ post: true, persist: true }` calls all in order.
- `generate_preview` handler: `429` when cap exceeded (mocked counter); `200` with
  remaining quota otherwise.
- `get_posts` handler: returns trimmed public shape; omits secret/internal fields.

**Frontend tests:** Vitest + React Testing Library on the dry-run component:
loading, success, and cap-reached (429) states render correctly against a mocked
fetch. Kept small; backend carries the coverage weight.

**CI gating:** test step becomes a real `vitest run` (replacing
`echo "No tests yet..."`) and **blocks deploy on failure** in both workflows. CI
badge in README.

## Docs and presentation

**README rewrite** (root `README.md`, consolidating current `ReadMe.md`):

- Title, one-line pitch, badges (CI status, license, tech stack), prominent
  **Live Demo** link.
- Embedded architecture diagram under the intro.
- 2-3 screenshots / short GIF of the dashboard (gallery + live dry-run).
- Tightened, accurate sections: Features, Architecture, Local Development,
  Deployment, Testing. Every command works against the real repo (fixes current
  README<->repo drift, e.g. references to a nonexistent `scripts/` dir and
  `test:dalle`/`test:storage` scripts).
- Remove placeholder `your-username` / `derek@example.com` from `package.json`;
  add real `LICENSE` (MIT).

**Architecture diagram** (`docs/architecture.md`): Mermaid (renders natively on
GitHub, no binary asset) showing Timer -> Function App -> OpenAI (GPT-4.1 +
DALL-E 3) -> Blob Storage + Cosmos DB -> LinkedIn API, plus the Next.js dashboard
reading via `/api/posts` and `/api/preview`. Short data-flow walkthrough beneath.

**Honesty guardrails:** screenshots are of the actual running app, captured during
implementation. README claims nothing the code does not do. No em-dashes anywhere.

Screenshots/GIF require the app running; the dashboard will run locally against
real Azure resources or sample data, visuals captured from that. A clearly-marked
placeholder holds the final live-demo URL until deployed.

## CI/CD and deployment

- **`api-deploy.yml`** (existing, renamed): update project path
  `./linkedin_ai_auto_poster` -> `./api`; make the test step a real `vitest run`
  that fails the build on test failure (today `--if-present` silently passes);
  scope trigger to `api/**` and shared files.
- **`web-deploy.yml`** (new): build and deploy Next.js to Azure Static Web Apps via
  `Azure/static-web-apps-deploy`, triggered on `web/**`. Runs frontend tests before
  deploy. Uses an SWA deployment token from a GitHub secret.
- **Path-filtered triggers** keep the two apps deploying independently.

**Owner-only tasks (require Azure portal / credentials, documented as a checklist
in `docs/deployment.md`):**

- Create the Azure Static Web Apps resource and link it to the existing Function
  App.
- Add the SWA deployment token as a GitHub secret.
- Add new env vars to the Function App (DALL-E endpoint vars, `DRYRUN_DAILY_CAP`).
- Capture the final live-demo URL into the README.

## Implementation phasing

Structured so value ships incrementally, in independently-useful phases:

1. **Quality pass + tests** — strict mode, dependency bumps, env-var hardening,
   `linkedInPostFlow` options-object refactor, Vitest suite, CI test gate.
2. **New endpoints** — `get_posts`, `generate_preview` with daily-cap counter.
3. **Frontend** — Next.js dashboard + `web-deploy.yml`.
4. **Docs and deploy** — README rewrite, architecture diagram, deployment doc,
   screenshots, LICENSE.

## Out of scope (YAGNI)

- Authentication / user accounts on the dashboard.
- Multi-page dashboard or post-editing UI.
- Monorepo build tooling (Turborepo, npm workspaces).
- Per-IP rate limiting or captcha (global daily cap is sufficient for a demo).
- Simulated/canned dry-run (we use a real, capped live generation).
```
