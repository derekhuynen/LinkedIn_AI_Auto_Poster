# Phase 3: Next.js Dashboard Implementation Plan

> **For agentic workers:** This phase is visual. Build the structure/logic/tests exactly as specified, then refine the visual components against rendered screenshots (Playwright) until they match the aesthetic direction. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A single-page, dark, "developer-tool" dashboard (`web/`) that showcases the project: a hero, a live rate-capped dry-run panel calling `POST /api/preview`, and a gallery reading `GET /api/posts`. Deployed as a static Next.js export to Azure Static Web Apps with the existing Function App as a same-origin linked backend.

**Architecture:** Next.js 15 (App Router) with `output: 'export'` (fully static). The gallery and dry-run are client components that call the API at runtime; the hero/footer are static. A `lib/api.ts` client talks to the API same-origin (`/api/*`) in production (SWA linked backend) and, in a **sample-data mode** (default for local dev), returns bundled fixtures so the app renders fully without Azure. Deployed via a new `web-deploy.yml` GitHub Actions workflow.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS v4, `next/font` (Bricolage Grotesque / Hanken Grotesk / JetBrains Mono), Vitest + React Testing Library + jsdom, Azure Static Web Apps.

This is the third of four plans from `docs/superpowers/specs/2026-05-29-showcase-upgrade-design.md`. It depends on Phase 2's `GET /api/posts` and `POST /api/preview` (merged).

---

## Design system (the aesthetic contract)

- **Theme:** dark. Base `--bg: #0b0d10`, raised `--surface: #14171c`, hairline `--border: #232830`, text `--fg: #e7ecf2`, muted `--muted: #8b95a3`.
- **Accent:** electric cyan `--accent: #22d3ee` with a cooler companion `--accent-2: #38bdf8` for gradients. No purple-on-white. Accent used sparingly: focus rings, key CTAs, the live "generating" pulse, link underlines.
- **Type:** display = Bricolage Grotesque (700/600), body = Hanken Grotesk (400/500), mono = JetBrains Mono (500) for eyebrow labels, metadata (dates, counts, URNs of status), and the "terminal" feel.
- **Texture:** hero has a faint radial gradient mesh (accent → transparent) plus a subtle grain overlay and a 1px dotted grid; cards are `--surface` with 1px `--border`, rounded-xl, and a soft accent-tinted shadow on hover (translateY -2px).
- **Motion:** one orchestrated page-load: hero eyebrow → headline → subtext → CTA stagger via animation-delay; cards fade-up on first paint. Hover lifts. Respect `prefers-reduced-motion`.
- **Voice:** confident, technical, concise. Mono eyebrow labels like `// AI CONTENT PIPELINE`. No emoji in the UI.

## File structure for this phase

```
web/
├── package.json
├── next.config.ts            # output: 'export', images.unoptimized, dev rewrite to :7071
├── tsconfig.json
├── vitest.config.ts
├── vitest.setup.ts
├── postcss.config.mjs
├── .gitignore
├── .env.development          # NEXT_PUBLIC_USE_SAMPLE_DATA=true
├── staticwebapp.config.json  # SWA routing + security headers
├── public/
│   ├── samples/feed-01.svg ... feed-04.svg   # sample "AI images"
│   └── grain.svg
├── app/
│   ├── layout.tsx            # fonts, <html dark>, metadata
│   ├── globals.css           # Tailwind v4 import + @theme tokens + base
│   └── page.tsx              # assembles Hero + DryRunPanel + Gallery + Footer
├── components/
│   ├── Hero.tsx
│   ├── DryRunPanel.tsx       # client: calls POST /api/preview
│   ├── Gallery.tsx           # client: fetches GET /api/posts, paginates
│   ├── PostCard.tsx
│   ├── TechBadges.tsx
│   └── Footer.tsx
├── lib/
│   ├── types.ts              # PublicPost, PreviewResult (mirror api/)
│   ├── api.ts                # getPosts(), generatePreview() with sample fallback
│   └── sampleData.ts         # fixtures for sample mode
└── tests/
    └── DryRunPanel.test.tsx  # loading / success / 429 states
```

All paths relative to repo root. Work on branch `feat/phase3-dashboard`.

---

### Task 1: Scaffold the Next.js app

**Files:** create `web/` via the Next.js CLI, then adjust config.

- [ ] **Step 1: Scaffold non-interactively**

Run from repo root:
```bash
npx --yes create-next-app@latest web --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-turbopack --use-npm
```
Expected: `web/` created with App Router, Tailwind v4, TypeScript. If it prompts despite flags, accept defaults matching the flags above.

- [ ] **Step 2: Configure static export and dev API proxy**

Replace `web/next.config.ts` with:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// Fully static export for Azure Static Web Apps.
	output: 'export',
	// No Next image optimizer in a static export.
	images: { unoptimized: true },
	// Dev-only: proxy /api to the local Functions host so same-origin fetches work
	// during `next dev`. In production the SWA linked backend serves /api/*.
	async rewrites() {
		if (process.env.NODE_ENV === 'development') {
			return [
				{
					source: '/api/:path*',
					destination: 'http://localhost:7071/api/:path*',
				},
			];
		}
		return [];
	},
};

export default nextConfig;
```

- [ ] **Step 3: Set strict TypeScript**

In `web/tsconfig.json`, ensure `"strict": true` is present under `compilerOptions` (create-next-app sets this by default; confirm and leave it).

- [ ] **Step 4: Sample-mode env default for dev**

Create `web/.env.development`:
```
NEXT_PUBLIC_USE_SAMPLE_DATA=true
```

- [ ] **Step 5: Confirm it builds**

Run:
```bash
cd web && npm run build
```
Expected: a successful static export to `web/out/`.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "feat(web): scaffold Next.js static-export app"
```

---

### Task 2: Types, API client, and sample fixtures

**Files:**
- Create: `web/lib/types.ts`, `web/lib/api.ts`, `web/lib/sampleData.ts`
- Create: `web/public/samples/feed-01.svg` ... `feed-04.svg`

- [ ] **Step 1: Types (mirror the API's public shapes)**

Create `web/lib/types.ts`:
```ts
/** Mirrors api/src/types/PublicPost.ts */
export type PublicPost = {
	topic: string;
	topicDescription?: string;
	linkedInPost: string;
	blobStorageUrl?: string;
	createdAt: string;
	triggerBy?: string;
};

export type PostsResponse = {
	posts: PublicPost[];
	continuationToken?: string;
};

/** Shape returned by POST /api/preview on success. */
export type PreviewResult = {
	topic: string;
	topicDescription?: string;
	linkedInPost: string;
	imageUrl?: string;
	createdAt: string;
	remaining: number;
};

/** Thrown when the daily demo cap is hit (HTTP 429). */
export class RateLimitError extends Error {
	resetsAt: string;
	constructor(message: string, resetsAt: string) {
		super(message);
		this.name = 'RateLimitError';
		this.resetsAt = resetsAt;
	}
}
```

- [ ] **Step 2: Sample fixtures**

Create `web/lib/sampleData.ts`:
```ts
import { PostsResponse, PreviewResult } from './types';

export const SAMPLE_POSTS: PostsResponse = {
	posts: [
		{
			topic: 'Why Idempotency Keys Belong in Every Write API',
			topicDescription:
				'Designing retry-safe endpoints so duplicate requests never double-charge or double-post.',
			linkedInPost:
				'Most outages I have debugged were not caused by the failure itself. They were caused by the retry.\n\nWhen a client times out and retries a write, an API without idempotency keys happily creates a second record. Now you have two charges, two posts, two emails.\n\nThe fix is small: accept an Idempotency-Key header, store the first result against it, and replay that result on any retry with the same key...',
			blobStorageUrl: '/samples/feed-01.svg',
			createdAt: '2026-05-28T09:00:00.000Z',
			triggerBy: 'timer',
		},
		{
			topic: 'Vector Databases Are Just Indexes With Better PR',
			topicDescription:
				'A grounded look at when approximate nearest neighbor search actually earns its keep.',
			linkedInPost:
				'Every team I talk to wants a vector database. Half of them have under 50,000 documents.\n\nAt that scale, a brute-force cosine similarity in memory returns in single-digit milliseconds. You do not need an ANN index, a new service, or a new bill...',
			blobStorageUrl: '/samples/feed-02.svg',
			createdAt: '2026-05-27T09:00:00.000Z',
			triggerBy: 'timer',
		},
		{
			topic: 'The Cheapest Observability Win: Structured Logs',
			topicDescription:
				'Trading printf debugging for queryable JSON events you can actually alert on.',
			linkedInPost:
				'You do not need a tracing vendor to ten-x your debugging. You need to stop logging strings.\n\nThe moment your logs become JSON with a stable schema, every field is filterable...',
			blobStorageUrl: '/samples/feed-03.svg',
			createdAt: '2026-05-26T09:00:00.000Z',
			triggerBy: 'timer',
		},
		{
			topic: 'Serverless Is Not About Servers, It Is About Ownership',
			topicDescription:
				'Reframing the trade-offs of functions-as-a-service around operational burden, not infrastructure.',
			linkedInPost:
				'The serverless debate keeps getting stuck on cold starts. That is the wrong axis.\n\nThe real question is who carries the pager for the host OS, the runtime patches, and the autoscaler...',
			blobStorageUrl: '/samples/feed-04.svg',
			createdAt: '2026-05-25T09:00:00.000Z',
			triggerBy: 'timer',
		},
	],
	continuationToken: undefined,
};

export const SAMPLE_PREVIEW: PreviewResult = {
	topic: 'Backpressure Is a Feature, Not a Bug',
	topicDescription:
		'Why letting a queue say "no" protects the whole system from cascading failure.',
	linkedInPost:
		'A queue that never pushes back is a queue that is lying to you.\n\nWhen producers outpace consumers and nothing slows them down, latency climbs silently until the whole pipeline tips over at once. Backpressure turns that cliff into a gentle slope: the system sheds or delays load deliberately instead of collapsing...\n\nThe next time you design a pipeline, decide where it is allowed to say no. That decision is your reliability budget.',
	imageUrl: '/samples/feed-02.svg',
	createdAt: '2026-05-29T12:00:00.000Z',
	remaining: 49,
};
```

- [ ] **Step 3: API client with sample fallback**

Create `web/lib/api.ts`:
```ts
import {
	PostsResponse,
	PreviewResult,
	RateLimitError,
} from './types';
import { SAMPLE_POSTS, SAMPLE_PREVIEW } from './sampleData';

const USE_SAMPLE = process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === 'true';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Fetches a page of the public gallery. */
export async function getPosts(
	limit = 12,
	continuationToken?: string
): Promise<PostsResponse> {
	if (USE_SAMPLE) {
		await delay(400);
		return SAMPLE_POSTS;
	}
	const params = new URLSearchParams({ limit: String(limit) });
	if (continuationToken) params.set('continuationToken', continuationToken);
	const res = await fetch(`${API_BASE}/api/posts?${params.toString()}`);
	if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
	return (await res.json()) as PostsResponse;
}

/** Triggers a live dry-run. Throws RateLimitError on 429. */
export async function generatePreview(): Promise<PreviewResult> {
	if (USE_SAMPLE) {
		await delay(1800);
		return SAMPLE_PREVIEW;
	}
	const res = await fetch(`${API_BASE}/api/preview`, { method: 'POST' });
	if (res.status === 429) {
		const body = await res.json().catch(() => ({}));
		throw new RateLimitError(
			body.error ?? 'Daily demo limit reached.',
			body.resetsAt ?? ''
		);
	}
	if (!res.ok) throw new Error(`Failed to generate preview (${res.status})`);
	return (await res.json()) as PreviewResult;
}
```

- [ ] **Step 4: Sample SVG images**

Create four files `web/public/samples/feed-01.svg` through `feed-04.svg`. Each is a 1200x630 abstract gradient/grid placeholder in the dark+cyan palette. Use this template, varying the gradient stops and seed per file (rotate hue between cyan `#22d3ee`, blue `#38bdf8`, teal `#2dd4bf`, and a deep indigo `#334155` for variety):
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
	<defs>
		<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#0b0d10"/>
			<stop offset="1" stop-color="#14171c"/>
		</linearGradient>
		<radialGradient id="a" cx="0.7" cy="0.3" r="0.8">
			<stop offset="0" stop-color="#22d3ee" stop-opacity="0.55"/>
			<stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
		</radialGradient>
	</defs>
	<rect width="1200" height="630" fill="url(#g)"/>
	<rect width="1200" height="630" fill="url(#a)"/>
	<g stroke="#e7ecf2" stroke-opacity="0.06">
		<!-- sparse grid lines; repeat every 60px -->
		<path d="M60 0V630M120 0V630M180 0V630M240 0V630M300 0V630M360 0V630M420 0V630M480 0V630M540 0V630M600 0V630M660 0V630M720 0V630M780 0V630M840 0V630M900 0V630M960 0V630M1020 0V630M1080 0V630M1140 0V630"/>
		<path d="M0 60H1200M0 120H1200M0 180H1200M0 240H1200M0 300H1200M0 360H1200M0 420H1200M0 480H1200M0 540H1200M0 600H1200"/>
	</g>
</svg>
```
(Vary `#22d3ee` in the radial stop per file for visual variety. These clearly read as "generated cover art" placeholders for the demo.)

- [ ] **Step 5: Typecheck**

Run:
```bash
cd web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/lib web/public/samples
git commit -m "feat(web): add types, API client with sample-data fallback, and fixtures"
```

---

### Task 3: Design tokens, fonts, and layout shell

**Files:**
- Modify: `web/app/globals.css`, `web/app/layout.tsx`

- [ ] **Step 1: Fonts and metadata in the layout**

Replace `web/app/layout.tsx` with:
```tsx
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
	subsets: ['latin'],
	weight: ['600', '700'],
	variable: '--font-display',
});
const body = Hanken_Grotesk({
	subsets: ['latin'],
	weight: ['400', '500'],
	variable: '--font-body',
});
const mono = JetBrains_Mono({
	subsets: ['latin'],
	weight: ['500'],
	variable: '--font-mono',
});

export const metadata: Metadata = {
	title: 'LinkedIn AI Auto Poster',
	description:
		'An AI content pipeline on Azure: GPT-4.1 + DALL-E 3 generate and publish LinkedIn posts on a schedule.',
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
			<body>{children}</body>
		</html>
	);
}
```

- [ ] **Step 2: Tokens and base styles**

Replace `web/app/globals.css` with a Tailwind v4 import plus an `@theme` block exposing the design tokens, dark base styles, the grain/grid background utilities, and keyframes for the page-load reveal and the "generating" pulse. (Full starter CSS is provided in the implementation; it defines `--color-bg/surface/border/fg/muted/accent/accent-2`, maps `--font-display/body/mono`, sets `body { background: var(--bg); color: var(--fg); font-family: var(--font-body); }`, adds a `.mesh` hero background, a `.grain` overlay, `.reveal` fade-up with staggered `--delay`, and honors `prefers-reduced-motion`.)

- [ ] **Step 3: Confirm dev server renders dark base**

Run `cd web && npm run dev`, open the page, confirm the dark background and fonts load. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/app/layout.tsx
git commit -m "feat(web): dark design tokens, fonts, and base styles"
```

---

### Task 4: Hero, TechBadges, Footer (static)

**Files:** create `web/components/Hero.tsx`, `web/components/TechBadges.tsx`, `web/components/Footer.tsx`.

- [ ] **Step 1: Build the three static sections** following the design system: mono eyebrow `// AI CONTENT PIPELINE`, a Bricolage display headline, a muted one-line subtext, a primary CTA that scrolls to the dry-run panel and a secondary "View source" link to the GitHub repo, the `TechBadges` row (Azure Functions, GPT-4.1, DALL-E 3, Cosmos DB, Next.js as mono pills with hairline borders), and a footer with a one-line architecture summary and links. Use the `.mesh`/`.grain` hero background and the `.reveal` staggered load.

- [ ] **Step 2: Visual refinement** (see Task 8 process): render, screenshot, refine spacing/scale/contrast until it matches "developer-tool landing page."

- [ ] **Step 3: Commit** `feat(web): hero, tech badges, and footer`.

---

### Task 5: Gallery and PostCard (client fetch + pagination)

**Files:** create `web/components/Gallery.tsx`, `web/components/PostCard.tsx`.

- [ ] **Step 1: PostCard** renders one `PublicPost`: the sample/blob image as a 16:9 cover (`<img>`, since images are unoptimized), the topic as a Bricolage card title, a 3-line clamp of `linkedInPost`, and a mono footer row with the formatted `createdAt` and a `triggerBy` tag. Hairline border, hover lift with accent-tinted shadow.

- [ ] **Step 2: Gallery** is a client component: on mount calls `getPosts()`, shows a skeleton grid while loading, an error state if it throws, an empty state if `posts.length === 0`, else a responsive grid of `PostCard`s. If `continuationToken` is present, render a "Load more" button that fetches the next page and appends.

- [ ] **Step 3: Visual refinement** against screenshots.

- [ ] **Step 4: Commit** `feat(web): gallery feed with pagination and post cards`.

---

### Task 6: DryRunPanel (live generation) + page assembly

**Files:** create `web/components/DryRunPanel.tsx`; replace `web/app/page.tsx`.

- [ ] **Step 1: DryRunPanel** (client) with an explicit state machine: `idle | loading | success | capped | error`.
  - Idle: a headline, a one-line explainer, a primary "Generate a sample post" button, and a mono caption `// nothing is published to LinkedIn`.
  - Loading: button shows a pulsing "Generating..." with the accent; a skeleton of the result card.
  - Success: render the generated post in a LinkedIn-post-style card (image + body + topic) and a mono line `// N demo generations left today` from `result.remaining`.
  - Capped (catch `RateLimitError`): a calm notice "Daily demo limit reached" plus `resetsAt` formatted, button disabled.
  - Error: a generic "Something went wrong, try again" with the button re-enabled.

- [ ] **Step 2: Assemble** `web/app/page.tsx` as `<main>`: `Hero` → `DryRunPanel` (with an `id` the hero CTA targets) → `Gallery` → `Footer`.

- [ ] **Step 3: Visual refinement** against screenshots for all states (idle/loading/success/capped).

- [ ] **Step 4: Commit** `feat(web): live dry-run panel and page assembly`.

---

### Task 7: Component tests

**Files:** create `web/vitest.config.ts`, `web/vitest.setup.ts`, `web/tests/DryRunPanel.test.tsx`. Add dev deps.

- [ ] **Step 1: Install test deps**

Run:
```bash
cd web && npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Vitest config (jsdom + React)**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./vitest.setup.ts'],
		include: ['tests/**/*.test.tsx'],
	},
	resolve: { alias: { '@': resolve(__dirname, '.') } },
});
```

Create `web/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom';
```

Add to `web/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Test the DryRunPanel state machine**

Create `web/tests/DryRunPanel.test.tsx` mocking `@/lib/api`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ generatePreview: vi.fn() }));
vi.mock('@/lib/api', () => ({ generatePreview: mocks.generatePreview }));

import DryRunPanel from '@/components/DryRunPanel';
import { RateLimitError } from '@/lib/types';

describe('DryRunPanel', () => {
	beforeEach(() => vi.clearAllMocks());

	it('shows the generated post on success', async () => {
		mocks.generatePreview.mockResolvedValue({
			topic: 'Test Topic',
			linkedInPost: 'Generated body text',
			imageUrl: '/samples/feed-01.svg',
			createdAt: '2026-05-29T00:00:00.000Z',
			remaining: 49,
		});
		render(<DryRunPanel />);
		await userEvent.click(screen.getByRole('button', { name: /generate/i }));
		expect(await screen.findByText('Test Topic')).toBeInTheDocument();
		expect(screen.getByText(/49/)).toBeInTheDocument();
	});

	it('shows the cap notice on a RateLimitError', async () => {
		mocks.generatePreview.mockRejectedValue(
			new RateLimitError('Daily demo limit reached.', '2026-05-30T00:00:00.000Z')
		);
		render(<DryRunPanel />);
		await userEvent.click(screen.getByRole('button', { name: /generate/i }));
		expect(await screen.findByText(/limit reached/i)).toBeInTheDocument();
	});

	it('shows a generic error on other failures', async () => {
		mocks.generatePreview.mockRejectedValue(new Error('boom'));
		render(<DryRunPanel />);
		await userEvent.click(screen.getByRole('button', { name: /generate/i }));
		expect(await screen.findByText(/went wrong/i)).toBeInTheDocument();
	});
});
```
(The DryRunPanel copy must contain matching text: a "Generate ..." button, "left today" with the remaining number, "limit reached", and "went wrong".)

- [ ] **Step 4: Run tests**

Run:
```bash
cd web && npm test
```
Expected: 3 passing.

- [ ] **Step 5: Commit** `test(web): cover DryRunPanel success, capped, and error states`.

---

### Task 8: Visual refinement loop (Playwright)

For each visual task (4, 5, 6), do NOT consider it done until it has been viewed and refined:

- [ ] **Step 1:** `cd web && npm run dev` (sample mode is on by default, so the gallery and dry-run render with fixtures, no Azure needed).
- [ ] **Step 2:** Use Playwright to navigate to `http://localhost:3000`, take a full-page screenshot, and screenshot the dry-run success and capped states (trigger via the UI).
- [ ] **Step 3:** Critique against the design system (type scale, spacing rhythm, contrast, accent restraint, hover/lift, load stagger). Fix issues in the components.
- [ ] **Step 4:** Re-screenshot until it reads as a polished developer-tool landing page. Capture the final screenshots into `docs/images/` for the Phase 4 README.

---

### Task 9: Deployment workflow and SWA config

**Files:** create `web/staticwebapp.config.json`, `.github/workflows/web-deploy.yml`.

- [ ] **Step 1: SWA routing/security config**

Create `web/staticwebapp.config.json`:
```json
{
	"navigationFallback": {
		"rewrite": "/index.html",
		"exclude": ["/api/*", "/samples/*", "/*.{svg,png,jpg,ico,txt}"]
	},
	"globalHeaders": {
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
		"Referrer-Policy": "strict-origin-when-cross-origin"
	}
}
```

- [ ] **Step 2: Deploy workflow**

Create `.github/workflows/web-deploy.yml`:
```yaml
name: Build and deploy web dashboard

on:
  push:
    branches:
      - main
    paths:
      - 'web/**'
      - '.github/workflows/web-deploy.yml'
  workflow_dispatch:

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Install and test
        run: |
          cd web
          npm ci
          npm run test
          npm run build

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: 'upload'
          app_location: 'web'
          output_location: 'out'
          skip_app_build: true
          skip_api_build: true
```
(The workflow builds in the "Install and test" step and uploads the prebuilt `web/out`, so `skip_app_build` is true. The SWA deployment token is added as a GitHub secret by the owner.)

- [ ] **Step 3: Commit** `ci(web): add Azure Static Web Apps deploy workflow and SWA config`.

---

### Task 10: Final verification

- [ ] **Step 1:** `cd web && npx tsc --noEmit` — clean.
- [ ] **Step 2:** `cd web && npm run lint` — clean (fix any errors).
- [ ] **Step 3:** `cd web && npm test` — 3 passing.
- [ ] **Step 4:** `cd web && npm run build` — static export to `web/out/` succeeds.
- [ ] **Step 5:** `git status` — clean.

---

## Deployment checklist (owner tasks, for Phase 4's deployment doc)

- Create an Azure Static Web Apps resource; in its config, **link the existing Function App as the backend** (Bring your own Functions) so `/api/*` is served same-origin.
- Add the SWA deployment token as the GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
- After first deploy, copy the SWA URL into the README live-demo link (Phase 4).

## Self-review notes

- **Spec coverage:** hero + tech badges + GitHub link; live dry-run panel calling `POST /api/preview` with loading/success/capped/error states and remaining-quota display; gallery reading `GET /api/posts` with skeleton/empty/error/load-more; footer; dark "developer-tool" aesthetic via the design system; deployed to Azure Static Web Apps with same-origin linked backend.
- **SWA fit:** static export + client fetch is the robust SWA pattern; the spec's "RSC for gallery" is realized as client-side fetch with skeletons (a listed state), which is the correct choice for a static deploy.
- **No Azure needed to develop:** sample-data mode (default in `.env.development`) renders the full app offline and powers the Phase 4 screenshots; production uses same-origin `/api/*`.
- **Type parity:** `web/lib/types.ts` mirrors `api/src/types/PublicPost.ts` and the `/api/preview` response.
- **Tests:** the dry-run state machine (the interactive, cost-bearing surface) is covered; visual polish is verified via the Playwright refinement loop, not asserted in unit tests.
```
