# Phase 2: API Endpoints (Gallery + Rate-Capped Dry-Run) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two anonymous HTTP endpoints to the `api/` Function App: `GET /api/posts` (public gallery feed) and `POST /api/preview` (a live dry-run that generates a sample post but never publishes to LinkedIn, protected by a global daily cap).

**Architecture:** `get_posts` reads the existing Cosmos posts container and returns a trimmed, public-safe projection. `preview` enforces a global daily cap via a new `RateLimitService` (a dedicated Cosmos `RateLimits` container, partition key `/id`, one counter document per UTC day with ETag-based atomic increment), then calls the Phase 1 `linkedInPostFlow` in dry-run mode (`{ post: false, persist: false, generateImage: true }`). No CORS is implemented: production serves the web app and API same-origin via Azure Static Web Apps linked backend, and local dev proxies through Next.js rewrites (both set up in Phase 3).

**Tech Stack:** Azure Functions v4 (Node 20), TypeScript strict, `@azure/cosmos`, Vitest.

This is the second of four plans from `docs/superpowers/specs/2026-05-29-showcase-upgrade-design.md`. It depends on Phase 1 (merged): the options-object `linkedInPostFlow`, strict mode, and Vitest are already in place.

---

## New infrastructure this phase requires

A **second Cosmos container** named `RateLimits` (configurable) with **partition key `/id`**, in the same Cosmos database. A dedicated container (rather than reusing the posts container) is chosen because the posts container's partition key is not assumed here, and `/id` gives the rate-limit service a known, simple key. This is added to the deployment checklist; the implementer does not create Azure resources.

New environment variables (defaults shown):
- `COSMOS_RATELIMIT_CONTAINER` = `RateLimits`
- `DRYRUN_DAILY_CAP` = `50`

## File structure for this phase

- **Create:** `api/src/types/PublicPost.ts` (public projection type), `api/src/service/RateLimitService.ts`, `api/src/functions/get_posts.ts`, `api/src/functions/generate_preview.ts`.
- **Create (tests):** `api/tests/rateLimitService.test.ts`, `api/tests/getPosts.test.ts`, `api/tests/generatePreview.test.ts`.
- **Modify:** `api/src/constants/constants.ts` (add `PUBLIC_POSTS_QUERY`, cap/container helpers), `api/example.settings.json` (document new env vars).

All paths are relative to repo root `C:\dev\derekhuynen\LinkedIn_AI_Auto_Poster`. Work on branch `feat/phase2-endpoints`.

---

### Task 1: Public projection type and shared constants

**Files:**
- Create: `api/src/types/PublicPost.ts`
- Modify: `api/src/constants/constants.ts`

- [ ] **Step 1: Create the public projection type**

Create `api/src/types/PublicPost.ts`:

```ts
/**
 * The public-safe shape of a post returned by GET /api/posts and POST /api/preview.
 * Excludes internal/secret fields (LinkedIn asset URN, expiring DALL-E URL, raw research).
 */
export type PublicPost = {
	topic: string;
	topicDescription?: string;
	linkedInPost: string;
	blobStorageUrl?: string;
	createdAt: string;
	triggerBy?: string;
};
```

- [ ] **Step 2: Add the gallery query and config helpers to constants**

In `api/src/constants/constants.ts`, append at the end of the file (after the existing `export * from './dalle3_config';` line is fine, but add before it to keep the re-export last; place these additions just above that line):

```ts
// Public gallery feed: newest real auto-posts first. Projects only public-safe
// fields so secrets never leave Cosmos. Excludes rate-limit counter docs
// (which have no `topic`) via the WHERE clause.
export const PUBLIC_POSTS_QUERY =
	'SELECT c.topic, c.topicDescription, c.linkedInPost, c.blobStorageUrl, c.createdAt, c.triggerBy FROM c WHERE c.topic != null ORDER BY c.createdAt DESC';

// Default number of gallery items per page.
export const DEFAULT_POSTS_PAGE_SIZE = 12;

/** Global daily cap on /api/preview dry-runs. */
export function getDryRunDailyCap(): number {
	const raw = process.env.DRYRUN_DAILY_CAP;
	const parsed = raw ? parseInt(raw, 10) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

/** Cosmos container holding per-day dry-run counters. */
export function getRateLimitContainerId(): string {
	return process.env.COSMOS_RATELIMIT_CONTAINER || 'RateLimits';
}
```

- [ ] **Step 3: Document the new env vars in example.settings.json**

In `api/example.settings.json`, add these two keys inside the `Values` object (alphabetical-ish placement is fine):

```json
    "COSMOS_RATELIMIT_CONTAINER": "RateLimits",
    "DRYRUN_DAILY_CAP": "50",
```

- [ ] **Step 4: Typecheck**

Run:
```bash
cd api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add api/src/types/PublicPost.ts api/src/constants/constants.ts api/example.settings.json
git commit -m "feat: add public post type, gallery query, and dry-run cap config"
```

---

### Task 2: RateLimitService (global daily cap)

A focused service owning the per-day counter. It constructs its own `CosmosClient` (it needs ETag-conditional replace, which the generic `CosmosService` does not expose) and exposes one method: `checkAndIncrement`.

**Files:**
- Create: `api/src/service/RateLimitService.ts`
- Create: `api/tests/rateLimitService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/tests/rateLimitService.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	read: vi.fn(),
	create: vi.fn(),
	replace: vi.fn(),
	item: vi.fn(),
	container: vi.fn(),
}));

vi.mock('@azure/cosmos', () => {
	// item(id, pk) -> { read, replace }; container.items.create(...)
	const itemApi = { read: mocks.read, replace: mocks.replace };
	mocks.item.mockReturnValue(itemApi);
	const containerApi = {
		item: mocks.item,
		items: { create: mocks.create },
	};
	return {
		CosmosClient: vi.fn(() => ({
			database: () => ({ container: () => containerApi }),
		})),
	};
});

import { RateLimitService } from '../src/service/RateLimitService';

function setEnv() {
	process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';
	process.env.COSMOS_KEY = 'key';
	process.env.COSMOS_DATABASE_ID = 'AutoPoster';
	process.env.COSMOS_RATELIMIT_CONTAINER = 'RateLimits';
}

describe('RateLimitService.checkAndIncrement', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setEnv();
		const itemApi = { read: mocks.read, replace: mocks.replace };
		mocks.item.mockReturnValue(itemApi);
	});

	it('creates the counter on first use of the day and allows the run', async () => {
		// No doc yet -> read returns undefined resource.
		mocks.read
			.mockResolvedValueOnce({ resource: undefined })
			// after create, the read inside the increment loop sees count 0
			.mockResolvedValueOnce({
				resource: { id: 'dryrun-2026-05-29', count: 0 },
				etag: 'etag-0',
			});
		mocks.create.mockResolvedValue({});
		mocks.replace.mockResolvedValue({ resource: { count: 1 } });

		const service = new RateLimitService();
		const result = await service.checkAndIncrement('2026-05-29', 50);

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(49);
		expect(mocks.create).toHaveBeenCalledTimes(1);
		expect(mocks.replace).toHaveBeenCalledTimes(1);
	});

	it('allows and increments when under the cap', async () => {
		mocks.read.mockResolvedValue({
			resource: { id: 'dryrun-2026-05-29', count: 10 },
			etag: 'etag-10',
		});
		mocks.replace.mockResolvedValue({ resource: { count: 11 } });

		const service = new RateLimitService();
		const result = await service.checkAndIncrement('2026-05-29', 50);

		expect(result.allowed).toBe(true);
		expect(result.count).toBe(11);
		expect(result.remaining).toBe(39);
		expect(mocks.replace).toHaveBeenCalledTimes(1);
	});

	it('blocks and does not increment when the cap is reached', async () => {
		mocks.read.mockResolvedValue({
			resource: { id: 'dryrun-2026-05-29', count: 50 },
			etag: 'etag-50',
		});

		const service = new RateLimitService();
		const result = await service.checkAndIncrement('2026-05-29', 50);

		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
		expect(mocks.replace).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd api && npx vitest run tests/rateLimitService.test.ts
```
Expected: FAIL with "Cannot find module '../src/service/RateLimitService'".

- [ ] **Step 3: Implement `RateLimitService`**

Create `api/src/service/RateLimitService.ts`:

```ts
import { CosmosClient, Container } from '@azure/cosmos';
import { getRateLimitContainerId } from '../constants/constants';

/** Result of a cap check. */
export interface RateLimitResult {
	allowed: boolean;
	count: number;
	remaining: number;
}

/** One counter document per UTC day. */
interface CounterDoc {
	id: string;
	count: number;
}

/**
 * Enforces a global daily cap using a single Cosmos counter document per day.
 * The document id is `dryrun-<YYYY-MM-DD>` and the container partition key is `/id`.
 * Increments use ETag optimistic concurrency so concurrent callers cannot overspend.
 */
export class RateLimitService {
	private container: Container;

	constructor() {
		const endpoint = process.env.COSMOS_ENDPOINT;
		const key = process.env.COSMOS_KEY;
		const databaseId = process.env.COSMOS_DATABASE_ID;

		if (!endpoint || !key || !databaseId) {
			const missing = [
				!endpoint && 'COSMOS_ENDPOINT',
				!key && 'COSMOS_KEY',
				!databaseId && 'COSMOS_DATABASE_ID',
			]
				.filter(Boolean)
				.join(', ');
			throw new Error(
				`Missing required environment variables for RateLimitService: ${missing}`
			);
		}

		const client = new CosmosClient({ endpoint, key });
		this.container = client
			.database(databaseId)
			.container(getRateLimitContainerId());
	}

	/**
	 * Atomically checks the day's counter against the cap and, if under, increments it.
	 * @param day - UTC date string `YYYY-MM-DD`.
	 * @param cap - Maximum allowed increments for the day.
	 * @returns allowed=false (with remaining 0) if the cap is reached, else allowed=true with the new count.
	 */
	async checkAndIncrement(day: string, cap: number): Promise<RateLimitResult> {
		const id = `dryrun-${day}`;

		// Up to a few attempts to resolve ETag races under concurrency.
		for (let attempt = 0; attempt < 5; attempt++) {
			const { resource, etag } = await this.readOrCreate(id);
			const current = resource.count;

			if (current >= cap) {
				return { allowed: false, count: current, remaining: 0 };
			}

			try {
				await this.container
					.item(id, id)
					.replace<CounterDoc>(
						{ id, count: current + 1 },
						{ accessCondition: { type: 'IfMatch', condition: etag } }
					);
				const newCount = current + 1;
				return {
					allowed: true,
					count: newCount,
					remaining: Math.max(0, cap - newCount),
				};
			} catch (error: any) {
				// 412 Precondition Failed -> another caller incremented; retry.
				if (error?.code === 412) {
					continue;
				}
				throw error;
			}
		}

		// Could not settle the race; fail closed (treat as capped) rather than overspend.
		return { allowed: false, count: cap, remaining: 0 };
	}

	/** Reads the counter, creating a fresh `{ count: 0 }` doc if today's does not exist yet. */
	private async readOrCreate(
		id: string
	): Promise<{ resource: CounterDoc; etag: string }> {
		const { resource, etag } = await this.container
			.item(id, id)
			.read<CounterDoc>();

		if (resource) {
			return { resource, etag: etag || '' };
		}

		try {
			await this.container.items.create<CounterDoc>({ id, count: 0 });
		} catch (error: any) {
			// 409 Conflict -> created concurrently; fall through to re-read below.
			if (error?.code !== 409) {
				throw error;
			}
		}

		const reread = await this.container.item(id, id).read<CounterDoc>();
		return {
			resource: reread.resource || { id, count: 0 },
			etag: reread.etag || '',
		};
	}
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd api && npx vitest run tests/rateLimitService.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Typecheck**

Run:
```bash
cd api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add api/src/service/RateLimitService.ts api/tests/rateLimitService.test.ts
git commit -m "feat: add RateLimitService for global daily dry-run cap"
```

---

### Task 3: GET /api/posts (gallery feed)

**Files:**
- Create: `api/src/functions/get_posts.ts`
- Create: `api/tests/getPosts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/tests/getPosts.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	queryItemsWithPagination: vi.fn(),
}));

vi.mock('../src/service/CosmosService', () => ({
	CosmosService: vi.fn(() => ({
		queryItemsWithPagination: mocks.queryItemsWithPagination,
	})),
}));

import { getPosts } from '../src/functions/get_posts';
import type { HttpRequest, InvocationContext } from '@azure/functions';

const context = { log: vi.fn() } as unknown as InvocationContext;

function makeRequest(query: Record<string, string> = {}): HttpRequest {
	return {
		query: { get: (k: string) => query[k] ?? null },
	} as unknown as HttpRequest;
}

describe('getPosts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.COSMOS_LINKEDIN_CONTAINER = 'LinkedInPosts';
	});

	it('returns the public projection and a continuation token', async () => {
		mocks.queryItemsWithPagination.mockResolvedValue({
			items: [
				{
					topic: 'AI in healthcare',
					topicDescription: 'desc',
					linkedInPost: 'body',
					blobStorageUrl: 'https://blob/img.jpg',
					createdAt: '2026-05-29T00:00:00.000Z',
					triggerBy: 'timer',
				},
			],
			continuationToken: 'token-abc',
		});

		const response = await getPosts(makeRequest(), context);

		expect(response.status).toBe(200);
		const body = response.jsonBody as {
			posts: Array<Record<string, unknown>>;
			continuationToken?: string;
		};
		expect(body.posts).toHaveLength(1);
		expect(body.continuationToken).toBe('token-abc');
		// Public-safe fields only; no secrets leaked.
		expect(body.posts[0]).toHaveProperty('topic', 'AI in healthcare');
		expect(body.posts[0]).not.toHaveProperty('imageAsset');
		expect(body.posts[0]).not.toHaveProperty('imageUrl');
		expect(body.posts[0]).not.toHaveProperty('research');
	});

	it('passes limit and continuationToken from the query string', async () => {
		mocks.queryItemsWithPagination.mockResolvedValue({
			items: [],
			continuationToken: undefined,
		});

		await getPosts(
			makeRequest({ limit: '5', continuationToken: 'prev' }),
			context
		);

		expect(mocks.queryItemsWithPagination).toHaveBeenCalledWith(
			expect.any(String),
			{ limit: 5, continuationToken: 'prev' }
		);
	});

	it('returns 500 with a generic message when the query fails', async () => {
		mocks.queryItemsWithPagination.mockRejectedValue(new Error('cosmos down'));

		const response = await getPosts(makeRequest(), context);

		expect(response.status).toBe(500);
		const body = response.jsonBody as { error: string };
		expect(body.error).toBeDefined();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd api && npx vitest run tests/getPosts.test.ts
```
Expected: FAIL with "Cannot find module '../src/functions/get_posts'".

- [ ] **Step 3: Implement the endpoint**

Create `api/src/functions/get_posts.ts`:

```ts
import {
	app,
	HttpRequest,
	HttpResponseInit,
	InvocationContext,
} from '@azure/functions';
import { CosmosService } from '../service/CosmosService';
import { PublicPost } from '../types/PublicPost';
import {
	PUBLIC_POSTS_QUERY,
	DEFAULT_POSTS_PAGE_SIZE,
} from '../constants/constants';

/**
 * GET /api/posts -- public, read-only gallery feed of real auto-posted content.
 * Returns a trimmed projection (no secrets) plus a continuation token for paging.
 *
 * Query params:
 *   limit              - page size (default DEFAULT_POSTS_PAGE_SIZE)
 *   continuationToken  - Cosmos continuation token from a previous page
 */
export async function getPosts(
	request: HttpRequest,
	context: InvocationContext
): Promise<HttpResponseInit> {
	try {
		const containerId = process.env.COSMOS_LINKEDIN_CONTAINER;
		if (!containerId) {
			throw new Error('COSMOS_LINKEDIN_CONTAINER environment variable is not set');
		}

		const limitParam = request.query.get('limit');
		const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
		const limit =
			Number.isFinite(parsedLimit) && parsedLimit > 0
				? parsedLimit
				: DEFAULT_POSTS_PAGE_SIZE;

		const continuationToken =
			request.query.get('continuationToken') || undefined;

		const cosmosService = new CosmosService<PublicPost>({ containerId });
		const { items, continuationToken: nextToken } =
			await cosmosService.queryItemsWithPagination(PUBLIC_POSTS_QUERY, {
				limit,
				continuationToken,
			});

		return {
			status: 200,
			jsonBody: {
				posts: items,
				continuationToken: nextToken,
			},
		};
	} catch (error: any) {
		context.log('Error in getPosts:', {
			error: error.message,
			stack: error.stack,
		});
		return {
			status: 500,
			jsonBody: { error: 'Failed to load posts' },
		};
	}
}

app.http('get_posts', {
	methods: ['GET'],
	authLevel: 'anonymous',
	route: 'posts',
	handler: getPosts,
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd api && npx vitest run tests/getPosts.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Typecheck**

Run:
```bash
cd api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add api/src/functions/get_posts.ts api/tests/getPosts.test.ts
git commit -m "feat: add GET /api/posts public gallery endpoint"
```

---

### Task 4: POST /api/preview (rate-capped dry-run)

**Files:**
- Create: `api/src/functions/generate_preview.ts`
- Create: `api/tests/generatePreview.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/tests/generatePreview.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	checkAndIncrement: vi.fn(),
	linkedInPostFlow: vi.fn(),
}));

vi.mock('../src/service/RateLimitService', () => ({
	RateLimitService: vi.fn(() => ({
		checkAndIncrement: mocks.checkAndIncrement,
	})),
}));

vi.mock('../src/flow/linkedin_post_flow', () => ({
	linkedInPostFlow: mocks.linkedInPostFlow,
}));

import { generatePreview } from '../src/functions/generate_preview';
import type { HttpRequest, InvocationContext } from '@azure/functions';

const context = { log: vi.fn() } as unknown as InvocationContext;
const request = {} as HttpRequest;

describe('generatePreview', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.DRYRUN_DAILY_CAP = '50';
	});

	it('returns 429 and does not generate when the cap is reached', async () => {
		mocks.checkAndIncrement.mockResolvedValue({
			allowed: false,
			count: 50,
			remaining: 0,
		});

		const response = await generatePreview(request, context);

		expect(response.status).toBe(429);
		expect(mocks.linkedInPostFlow).not.toHaveBeenCalled();
		const body = response.jsonBody as { error: string; resetsAt: string };
		expect(body.error).toBeDefined();
		expect(body.resetsAt).toBeDefined();
	});

	it('runs a dry-run and returns the preview with remaining quota', async () => {
		mocks.checkAndIncrement.mockResolvedValue({
			allowed: true,
			count: 1,
			remaining: 49,
		});
		mocks.linkedInPostFlow.mockResolvedValue({
			topic: 'AI in healthcare',
			topicDescription: 'desc',
			linkedInPost: 'the post body',
			blobStorageUrl: 'https://blob/img.jpg',
			imageUrl: 'https://dalle/expiring.png',
			createdAt: '2026-05-29T00:00:00.000Z',
			triggerBy: 'preview',
		});

		const response = await generatePreview(request, context);

		expect(response.status).toBe(200);
		// Dry-run contract: never post, never persist, but do generate an image.
		expect(mocks.linkedInPostFlow).toHaveBeenCalledWith(
			context,
			expect.objectContaining({
				triggerBy: 'preview',
				post: false,
				persist: false,
				generateImage: true,
			})
		);
		const body = response.jsonBody as {
			topic: string;
			linkedInPost: string;
			imageUrl?: string;
			remaining: number;
		};
		expect(body.topic).toBe('AI in healthcare');
		expect(body.linkedInPost).toBe('the post body');
		// Prefers the durable blob URL over the expiring DALL-E URL.
		expect(body.imageUrl).toBe('https://blob/img.jpg');
		expect(body.remaining).toBe(49);
	});

	it('returns 500 when generation fails after the cap was consumed', async () => {
		mocks.checkAndIncrement.mockResolvedValue({
			allowed: true,
			count: 1,
			remaining: 49,
		});
		mocks.linkedInPostFlow.mockRejectedValue(new Error('openai down'));

		const response = await generatePreview(request, context);

		expect(response.status).toBe(500);
		const body = response.jsonBody as { error: string };
		expect(body.error).toBeDefined();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd api && npx vitest run tests/generatePreview.test.ts
```
Expected: FAIL with "Cannot find module '../src/functions/generate_preview'".

- [ ] **Step 3: Implement the endpoint**

Create `api/src/functions/generate_preview.ts`:

```ts
import {
	app,
	HttpRequest,
	HttpResponseInit,
	InvocationContext,
} from '@azure/functions';
import { RateLimitService } from '../service/RateLimitService';
import { linkedInPostFlow } from '../flow/linkedin_post_flow';
import { getDryRunDailyCap } from '../constants/constants';

/** UTC `YYYY-MM-DD` for the given date. */
function utcDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** ISO timestamp for the next UTC midnight after `date` (when the cap resets). */
function nextUtcMidnight(date: Date): string {
	const next = new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate() + 1,
			0,
			0,
			0,
			0
		)
	);
	return next.toISOString();
}

/**
 * POST /api/preview -- generates a sample LinkedIn post (topic + body + image) live,
 * but NEVER publishes to LinkedIn and NEVER persists to the gallery. Protected by a
 * global daily cap so a public demo cannot run up unbounded OpenAI cost.
 */
export async function generatePreview(
	request: HttpRequest,
	context: InvocationContext
): Promise<HttpResponseInit> {
	const now = new Date();
	const cap = getDryRunDailyCap();

	try {
		const rateLimiter = new RateLimitService();
		const limit = await rateLimiter.checkAndIncrement(utcDay(now), cap);

		if (!limit.allowed) {
			return {
				status: 429,
				jsonBody: {
					error: 'Daily demo limit reached. Please try again tomorrow.',
					resetsAt: nextUtcMidnight(now),
				},
			};
		}

		const result = await linkedInPostFlow(context, {
			triggerBy: 'preview',
			post: false,
			persist: false,
			generateImage: true,
		});

		return {
			status: 200,
			jsonBody: {
				topic: result.topic,
				topicDescription: result.topicDescription,
				linkedInPost: result.linkedInPost,
				// Prefer the durable blob URL; fall back to the expiring DALL-E URL.
				imageUrl: result.blobStorageUrl || result.imageUrl,
				createdAt: result.createdAt,
				remaining: limit.remaining,
			},
		};
	} catch (error: any) {
		context.log('Error in generatePreview:', {
			error: error.message,
			stack: error.stack,
		});
		return {
			status: 500,
			jsonBody: { error: 'Failed to generate preview' },
		};
	}
}

app.http('generate_preview', {
	methods: ['POST'],
	authLevel: 'anonymous',
	route: 'preview',
	handler: generatePreview,
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd api && npx vitest run tests/generatePreview.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Typecheck**

Run:
```bash
cd api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add api/src/functions/generate_preview.ts api/tests/generatePreview.test.ts
git commit -m "feat: add POST /api/preview rate-capped dry-run endpoint"
```

---

### Task 5: Full verification and build

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run:
```bash
cd api && npm test
```
Expected: all tests pass. Phase 1 added 13; this phase adds 9 (3 + 3 + 3) for **22 total**.

- [ ] **Step 2: Typecheck and build**

Run:
```bash
cd api && npm run typecheck && npm run build
```
Expected: clean typecheck; `dist/` emitted with `get_posts.js` and `generate_preview.js` under `dist/src/functions/`.

- [ ] **Step 3: Confirm the endpoints are registered for the Functions host**

Run:
```bash
node -e "const fs=require('fs'); const f=['get_posts','generate_preview']; const ok=f.every(n=>fs.existsSync('api/dist/src/functions/'+n+'.js')); console.log(ok?'endpoints-built':'MISSING')"
```
Expected: `endpoints-built`. (The Function App's `main` glob in `package.json` is `dist/src/{index.js,functions/*.js}`, so both new handlers register automatically.)

- [ ] **Step 4: Confirm the working tree is clean**

Run:
```bash
git status
```
Expected: "nothing to commit, working tree clean".

---

## Deployment checklist (owner tasks, documented for Phase 4's deployment doc)

These require the Azure portal and are not done by the implementer:
- Create a Cosmos container named `RateLimits` (or the value of `COSMOS_RATELIMIT_CONTAINER`) in the existing database, **partition key `/id`**.
- Add app settings to the Function App: `COSMOS_RATELIMIT_CONTAINER=RateLimits`, `DRYRUN_DAILY_CAP=50`.
- The preview endpoint requires the existing OpenAI/Blob env vars to be set (it generates an image during the dry-run).

## Self-review notes

- **Spec coverage:** Implements the spec's `GET /api/posts` (trimmed public shape, pagination) and `POST /api/preview` (dry-run via Phase 1 options object, global daily cap in Cosmos with ETag atomic increment, 429 with `resetsAt`, remaining quota, not persisted). The dedicated `RateLimits` container is a documented planning decision consistent with "counter doc in Cosmos keyed by date."
- **Dry-run safety:** `generate_preview` calls `linkedInPostFlow` with `post: false, persist: false`; the Phase 1 tests already prove that combination never reaches `postToLinkedIn`/`uploadImageToLinkedIn`/`createItem`. Task 4's test additionally asserts the options passed.
- **No secret leakage:** `get_posts` projects only public fields in the Cosmos query itself; Task 3's test asserts `imageAsset`/`imageUrl`/`research` are absent.
- **Type consistency:** `RateLimitResult { allowed, count, remaining }` defined in Task 2 is consumed identically in Task 4. `PublicPost` (Task 1) is the generic parameter for `CosmosService` in Task 3.
- **No CORS by design:** documented; same-origin via SWA linked backend (prod) and Next.js rewrites (dev), both set up in Phase 3.
- **No placeholders:** every code step shows complete content; every run step shows command and expected result.
```
