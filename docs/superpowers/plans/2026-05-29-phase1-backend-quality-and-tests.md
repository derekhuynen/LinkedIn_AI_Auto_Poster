# Phase 1: Backend Quality Pass + Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Function App folder to `api/`, turn on TypeScript strict mode, modernize dependencies, refactor the post flow into a type-enforced options-object mode, and add a real Vitest suite gated in CI.

**Architecture:** The existing Azure Functions app keeps its service/flow layering. `linkedInPostFlow` gains an explicit `{ post, persist, generateImage }` options object so "dry-run" becomes a first-class typed mode (foundation for the Phase 2 preview endpoint) instead of relying on scattered env flags. Tests mock the Azure/OpenAI service classes so they run hermetically with no network.

**Tech Stack:** TypeScript 5, Azure Functions v4, Vitest, Node 20.

This plan is the first of four (quality+tests → endpoints → frontend → docs/deploy) from the design at `docs/superpowers/specs/2026-05-29-showcase-upgrade-design.md`. It stands alone: when complete, the backend is stricter, modernized, and test-gated.

---

## File structure for this phase

- **Rename:** `linkedin_ai_auto_poster/` → `api/` (the whole Function App).
- **Modify:** `api/tsconfig.json` (strict), `api/package.json` (deps + scripts), `api/src/flow/linkedin_post_flow.ts` (options object), `api/src/functions/auto_post.ts` + `api/src/functions/test_linkedin_post.ts` (call sites), `api/src/service/CosmosService.ts` + `api/src/service/OpenAiService.ts` (strict fixes + env hardening), `.github/workflows/main_auto-poster-function.yml` (path + test gate).
- **Create:** `api/vitest.config.ts`, `api/tests/retryUtil.test.ts`, `api/tests/typeGuard.test.ts`, `api/tests/blobContentType.test.ts`, `api/tests/linkedInPostFlow.test.ts`.

All paths below are relative to the repo root `C:\dev\derekhuynen\LinkedIn_AI_Auto_Poster`. Work on the existing branch `docs/showcase-upgrade-design` or a new `feat/phase1-backend-quality` branch.

---

### Task 1: Rename the app folder to `api/`

**Files:**
- Rename: `linkedin_ai_auto_poster/` → `api/`
- Modify: `.github/workflows/main_auto-poster-function.yml:13`

- [ ] **Step 1: Rename with git so history is preserved**

Run:
```bash
git mv linkedin_ai_auto_poster api
```

- [ ] **Step 2: Verify the move**

Run:
```bash
git status
```
Expected: renames listed under "Changes to be committed", e.g. `renamed: linkedin_ai_auto_poster/package.json -> api/package.json`.

- [ ] **Step 3: Update the workflow package path**

In `.github/workflows/main_auto-poster-function.yml`, change line 13 from:
```yaml
  AZURE_FUNCTIONAPP_PACKAGE_PATH: './linkedin_ai_auto_poster' # set this to the path to your web app project, defaults to the repository root
```
to:
```yaml
  AZURE_FUNCTIONAPP_PACKAGE_PATH: './api' # path to the Azure Function App project
```

- [ ] **Step 4: Confirm no other references to the old path remain**

Run:
```bash
git grep -n "linkedin_ai_auto_poster" -- ':!docs/'
```
Expected: no output. (Docs are intentionally excluded; they are rewritten in the Phase 4 plan.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename function app folder to api"
```

---

### Task 2: Modernize dependencies and add Vitest

**Files:**
- Modify: `api/package.json`

- [ ] **Step 1: Update dependencies and scripts in `api/package.json`**

Replace the `scripts`, `dependencies`, and `devDependencies` blocks so they read:

```json
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "clean": "rimraf dist",
    "prestart": "npm run clean && npm run build",
    "start": "func start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "postbuild": "cpx \"src/prompts/*.md\" dist/src/prompts/"
  },
  "dependencies": {
    "@azure/cosmos": "^4.4.1",
    "@azure/functions": "^4.0.0",
    "@azure/storage-blob": "^12.27.0",
    "axios": "^1.9.0",
    "openai": "^4.100.0"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "cpx": "^1.5.0",
    "rimraf": "^5.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.1.0"
  },
```

Notes: `@types/axios` is removed (axios ships its own types). The broken `test:dalle` / `test:storage` scripts that pointed at nonexistent files are removed. TypeScript moves to v5.

- [ ] **Step 2: Install**

Run:
```bash
cd api && npm install
```
Expected: completes without errors; `node_modules` populated, `vitest` present.

- [ ] **Step 3: Verify Vitest is callable**

Run:
```bash
cd api && npx vitest run
```
Expected: exits cleanly reporting "No test files found" (we add tests next). This confirms the binary is installed.

- [ ] **Step 4: Commit**

```bash
git add api/package.json api/package-lock.json
git commit -m "build: modernize deps, drop @types/axios, add vitest"
```

---

### Task 3: Add Vitest config

**Files:**
- Create: `api/vitest.config.ts`

- [ ] **Step 1: Create `api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
	},
});
```

- [ ] **Step 2: Verify config loads**

Run:
```bash
cd api && npx vitest run
```
Expected: "No test files found in tests" (config is read, glob matches nothing yet).

- [ ] **Step 3: Commit**

```bash
git add api/vitest.config.ts
git commit -m "test: add vitest config"
```

---

### Task 4: Test and harden `retryUtil`

**Files:**
- Create: `api/tests/retryUtil.test.ts`
- Reference (no change expected): `api/src/service/retryUtil.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/tests/retryUtil.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/service/retryUtil';

const noopContext = { log: () => {} };

describe('withRetry', () => {
	it('returns the result when the function succeeds on the first try', async () => {
		const fn = vi.fn().mockResolvedValue('ok');
		const result = await withRetry(fn, 3, noopContext, 'op');
		expect(result).toBe('ok');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries then succeeds', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('transient'))
			.mockResolvedValueOnce('ok');
		const result = await withRetry(fn, 3, noopContext, 'op');
		expect(result).toBe('ok');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('throws the last error after exhausting retries', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('always fails'));
		await expect(withRetry(fn, 2, noopContext, 'op')).rejects.toThrow(
			'always fails'
		);
		// 1 initial attempt + 2 retries
		expect(fn).toHaveBeenCalledTimes(3);
	});
});
```

- [ ] **Step 2: Run and verify they pass**

Run:
```bash
cd api && npx vitest run tests/retryUtil.test.ts
```
Expected: 3 passing. (`retryUtil` is already correct; these lock in its contract.)

Note: the retry path uses `setTimeout` for backoff. These tests use real timers; total real delay across the failing test is under ~1s (200ms + 400ms), which is acceptable. Do NOT add fake timers here; they complicate the await chain without benefit.

- [ ] **Step 3: Commit**

```bash
git add api/tests/retryUtil.test.ts
git commit -m "test: cover withRetry success, retry, and exhaustion paths"
```

---

### Task 5: Test the topic type guard and `getContentType`

**Files:**
- Create: `api/tests/typeGuard.test.ts`
- Create: `api/tests/blobContentType.test.ts`
- Modify: `api/src/flow/linkedin_post_flow.ts` (export the type guard)
- Modify: `api/src/service/BlobStorageService.ts` (make `getContentType` testable)

- [ ] **Step 1: Export the type guard from the flow**

In `api/src/flow/linkedin_post_flow.ts`, change the guard declaration (currently around line 35) from:
```ts
function isGenerateTopicPromptResponse(
	obj: any
): obj is GenerateTopicPromptResponse {
```
to:
```ts
export function isGenerateTopicPromptResponse(
	obj: unknown
): obj is GenerateTopicPromptResponse {
	const o = obj as Record<string, unknown> | null;
	return (
		!!o &&
		typeof o === 'object' &&
		typeof o.topic === 'string' &&
		typeof o.topic_description === 'string' &&
		typeof o.research === 'string'
	);
}
```
(Also remove the now-unused old body. The behavior is identical; the signature is just strict-safe.)

- [ ] **Step 2: Write the type guard tests**

Create `api/tests/typeGuard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isGenerateTopicPromptResponse } from '../src/flow/linkedin_post_flow';

describe('isGenerateTopicPromptResponse', () => {
	const valid = {
		topic: 'AI in healthcare',
		topic_description: 'How AI assists diagnosis',
		research: 'Some background',
	};

	it('accepts a fully valid object', () => {
		expect(isGenerateTopicPromptResponse(valid)).toBe(true);
	});

	it('rejects null and non-objects', () => {
		expect(isGenerateTopicPromptResponse(null)).toBe(false);
		expect(isGenerateTopicPromptResponse('string')).toBe(false);
		expect(isGenerateTopicPromptResponse(42)).toBe(false);
	});

	it('rejects when a required field is missing', () => {
		const { research, ...missingResearch } = valid;
		expect(isGenerateTopicPromptResponse(missingResearch)).toBe(false);
	});

	it('rejects when a field has the wrong type', () => {
		expect(
			isGenerateTopicPromptResponse({ ...valid, topic: 123 })
		).toBe(false);
	});
});
```

- [ ] **Step 3: Run the type guard tests**

Run:
```bash
cd api && npx vitest run tests/typeGuard.test.ts
```
Expected: 4 passing.

- [ ] **Step 4: Expose `getContentType` for testing**

In `api/src/service/BlobStorageService.ts`, change the method signature (currently around line 92) from:
```ts
	private getContentType(fileName: string): string {
```
to:
```ts
	getContentType(fileName: string): string {
```
(Dropping `private` so it can be unit-tested directly. It stays an instance method; behavior is unchanged.)

- [ ] **Step 5: Write the content-type tests**

Create `api/tests/blobContentType.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { BlobStorageService } from '../src/service/BlobStorageService';

describe('BlobStorageService.getContentType', () => {
	let service: BlobStorageService;

	beforeEach(() => {
		process.env.AZURE_STORAGE_CONNECTION_STRING =
			'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net';
		service = new BlobStorageService();
	});

	it('maps known extensions to MIME types', () => {
		expect(service.getContentType('a.jpg')).toBe('image/jpeg');
		expect(service.getContentType('a.jpeg')).toBe('image/jpeg');
		expect(service.getContentType('a.png')).toBe('image/png');
		expect(service.getContentType('a.gif')).toBe('image/gif');
		expect(service.getContentType('a.webp')).toBe('image/webp');
	});

	it('falls back to octet-stream for unknown or missing extensions', () => {
		expect(service.getContentType('a.bmp')).toBe('application/octet-stream');
		expect(service.getContentType('noextension')).toBe(
			'application/octet-stream'
		);
	});
});
```

Note: the connection string above is a syntactically valid fake (account key `dGVzdA==` is base64 "test"). `BlobServiceClient.fromConnectionString` parses it without making a network call, so the constructor succeeds offline.

- [ ] **Step 6: Run the content-type tests**

Run:
```bash
cd api && npx vitest run tests/blobContentType.test.ts
```
Expected: 2 passing.

- [ ] **Step 7: Commit**

```bash
git add api/tests/typeGuard.test.ts api/tests/blobContentType.test.ts api/src/flow/linkedin_post_flow.ts api/src/service/BlobStorageService.ts
git commit -m "test: cover topic type guard and blob content-type mapping"
```

---

### Task 6: Refactor `linkedInPostFlow` to an options object

This is the core foundation for the Phase 2 preview endpoint. The flow stops reading `ENABLE_*` env flags directly and instead takes `{ post, persist, generateImage }`. Callers decide.

**Files:**
- Modify: `api/src/flow/linkedin_post_flow.ts`
- Modify: `api/src/functions/auto_post.ts`
- Modify: `api/src/functions/test_linkedin_post.ts`

- [ ] **Step 1: Add the options type and change the signature**

In `api/src/flow/linkedin_post_flow.ts`, add this exported interface just above the `linkedInPostFlow` function (after the type guard):

```ts
export interface LinkedInPostFlowOptions {
	/** What triggered the run, stored for auditing (e.g. 'timer', 'preview'). */
	triggerBy: string;
	/** Publish the generated post to LinkedIn. Set false for dry-runs. */
	post: boolean;
	/** Save the result to the Cosmos posts feed. Set false for dry-runs. */
	persist: boolean;
	/** Run DALL-E image generation (and the image prompt step). */
	generateImage: boolean;
}
```

Then change the function signature from:
```ts
export async function linkedInPostFlow(
	context: InvocationContext,
	triggerBy: string
): Promise<{
```
to:
```ts
export async function linkedInPostFlow(
	context: InvocationContext,
	options: LinkedInPostFlowOptions
): Promise<{
```

- [ ] **Step 2: Replace env-flag branches with options inside the flow body**

In the same file, make these four edits inside `linkedInPostFlow`:

(a) The `createdAt` and `triggerBy` usages: the body references `triggerBy` directly. Add near the top of the function body (right after `const containerId = ...`):
```ts
	const { triggerBy } = options;
```

(b) The image-prompt branch. Replace:
```ts
		if (process.env.ENABLE_IMAGE_PROMPT_GENERATION !== 'false') {
```
with:
```ts
		if (options.generateImage) {
```

(c) The image-generation branch. Replace:
```ts
				if (process.env.ENABLE_IMAGE_GENERATION === 'true') {
```
with:
```ts
				if (options.generateImage) {
```

(d) The LinkedIn-post branch. Replace:
```ts
			if (process.env.ENABLE_LINKEDIN_POST === 'true') {
```
with:
```ts
			if (options.post) {
```

(e) Wrap the Cosmos save (Step 5, the `await withRetry(() => cosmosService.createItem({...}), ...)` block) so it only persists when asked. Change:
```ts
		// Step 5: Save the LinkedIn post to Cosmos DB
		await withRetry(
			() =>
				cosmosService.createItem({
```
to:
```ts
		// Step 5: Save the LinkedIn post to Cosmos DB
		if (options.persist) {
			await withRetry(
				() =>
					cosmosService.createItem({
```
and add the matching closing brace after that `withRetry(...)` call's closing `);` (before the `return {` statement):
```ts
			);
		}
		return {
```
(The original ended the `withRetry` call with `);` then `return {`. You are wrapping that single call in an `if` block, so indent its body one level and close the brace before `return`.)

- [ ] **Step 3: Update the timer caller**

In `api/src/functions/auto_post.ts`, change the call (line 19) from:
```ts
		await linkedInPostFlow(context, 'timer');
```
to:
```ts
		await linkedInPostFlow(context, {
			triggerBy: 'timer',
			post: process.env.ENABLE_LINKEDIN_POST === 'true',
			persist: true,
			generateImage: process.env.ENABLE_IMAGE_GENERATION === 'true',
		});
```
(Env flags now live at the call site, preserving the existing production behavior exactly.)

- [ ] **Step 4: Update the test HTTP caller**

In `api/src/functions/test_linkedin_post.ts`, change the call (line 37) from:
```ts
		const { topic, linkedInPost } = await linkedInPostFlow(context, 'http');
```
to:
```ts
		const { topic, linkedInPost } = await linkedInPostFlow(context, {
			triggerBy: 'http',
			post: process.env.ENABLE_LINKEDIN_POST === 'true',
			persist: true,
			generateImage: process.env.ENABLE_IMAGE_GENERATION === 'true',
		});
```

- [ ] **Step 5: Typecheck**

Run:
```bash
cd api && npx tsc --noEmit
```
Expected: no errors related to `linkedInPostFlow` call signatures. (Other strict errors are handled in Task 8; at this point strict is still off, so expect a clean result.)

- [ ] **Step 6: Commit**

```bash
git add api/src/flow/linkedin_post_flow.ts api/src/functions/auto_post.ts api/src/functions/test_linkedin_post.ts
git commit -m "refactor: drive post flow with explicit options object"
```

---

### Task 7: Test the dry-run contract of `linkedInPostFlow`

This is the highest-value test: it proves that a dry-run (`post: false, persist: false`) never publishes to LinkedIn and never writes to Cosmos, and that the full run calls everything.

**Files:**
- Create: `api/tests/linkedInPostFlow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/tests/linkedInPostFlow.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock functions shared across the mocked service classes.
const mocks = vi.hoisted(() => ({
	generateResponse: vi.fn(),
	generateImage: vi.fn(),
	downloadImageAsBuffer: vi.fn(),
	postToLinkedIn: vi.fn(),
	uploadImageToLinkedIn: vi.fn(),
	uploadImage: vi.fn(),
	createItem: vi.fn(),
	queryItems: vi.fn(),
}));

vi.mock('../src/service/OpenAiService', () => ({
	OpenAiService: vi.fn(() => ({
		generateResponse: mocks.generateResponse,
		generateImage: mocks.generateImage,
		downloadImageAsBuffer: mocks.downloadImageAsBuffer,
	})),
}));

vi.mock('../src/service/LinkedinService', () => ({
	default: vi.fn(() => ({
		postToLinkedIn: mocks.postToLinkedIn,
		uploadImageToLinkedIn: mocks.uploadImageToLinkedIn,
	})),
}));

vi.mock('../src/service/CosmosService', () => ({
	CosmosService: vi.fn(() => ({
		queryItems: mocks.queryItems,
		createItem: mocks.createItem,
	})),
}));

vi.mock('../src/service/BlobStorageService', () => ({
	BlobStorageService: vi.fn(() => ({
		uploadImage: mocks.uploadImage,
	})),
}));

import { linkedInPostFlow } from '../src/flow/linkedin_post_flow';
import type { InvocationContext } from '@azure/functions';

const context = { log: vi.fn() } as unknown as InvocationContext;

function primeHappyPath() {
	mocks.queryItems.mockResolvedValue([]);
	// First generateResponse call = topic JSON; later calls = post text / image prompt.
	mocks.generateResponse
		.mockResolvedValueOnce(
			JSON.stringify({
				topic: 'AI in healthcare',
				topic_description: 'How AI assists diagnosis',
				research: 'background',
			})
		)
		.mockResolvedValue('generated text');
	mocks.generateImage.mockResolvedValue('https://dalle/image.png');
	mocks.downloadImageAsBuffer.mockResolvedValue(Buffer.from('img'));
	mocks.uploadImage.mockResolvedValue('https://blob/image.jpg');
	mocks.uploadImageToLinkedIn.mockResolvedValue('urn:li:digitalmediaAsset:123');
	mocks.postToLinkedIn.mockResolvedValue(undefined);
	mocks.createItem.mockResolvedValue({});
}

describe('linkedInPostFlow', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.COSMOS_LINKEDIN_CONTAINER = 'LinkedInPosts';
		primeHappyPath();
	});

	it('dry-run never posts to LinkedIn and never persists', async () => {
		await linkedInPostFlow(context, {
			triggerBy: 'preview',
			post: false,
			persist: false,
			generateImage: true,
		});

		expect(mocks.postToLinkedIn).not.toHaveBeenCalled();
		expect(mocks.uploadImageToLinkedIn).not.toHaveBeenCalled();
		expect(mocks.createItem).not.toHaveBeenCalled();
	});

	it('full run posts to LinkedIn and persists to Cosmos', async () => {
		await linkedInPostFlow(context, {
			triggerBy: 'timer',
			post: true,
			persist: true,
			generateImage: true,
		});

		expect(mocks.postToLinkedIn).toHaveBeenCalledTimes(1);
		expect(mocks.createItem).toHaveBeenCalledTimes(1);
	});

	it('skips image generation when generateImage is false', async () => {
		await linkedInPostFlow(context, {
			triggerBy: 'preview',
			post: false,
			persist: false,
			generateImage: false,
		});

		expect(mocks.generateImage).not.toHaveBeenCalled();
		expect(mocks.uploadImageToLinkedIn).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run and verify it passes**

Run:
```bash
cd api && npx vitest run tests/linkedInPostFlow.test.ts
```
Expected: 3 passing.

If the dry-run test fails because `uploadImageToLinkedIn` was called, that means Task 6 step 2(d)/(e) was not applied correctly. Re-check that the LinkedIn upload sits inside the `if (options.post)` path is NOT the case here. Note: in the current flow the image upload to LinkedIn happens inside the image-generation block regardless of `post`. See Step 3.

- [ ] **Step 3: Gate the LinkedIn image upload on `options.post`**

The dry-run must not call `uploadImageToLinkedIn` (it touches the real LinkedIn API). In `api/src/flow/linkedin_post_flow.ts`, the image block uploads to both Blob Storage and LinkedIn. Wrap only the LinkedIn upload in `options.post`. Change:
```ts
					imageAsset = await withRetry(
						() =>
							linkedinService.uploadImageToLinkedIn(
								imageBuffer,
								'linkedin-post-image.jpg'
							),
						3,
						context,
						'linkedin.uploadImageToLinkedIn'
					);
					context.log('Image successfully uploaded to LinkedIn');
```
to:
```ts
					if (options.post) {
						imageAsset = await withRetry(
							() =>
								linkedinService.uploadImageToLinkedIn(
									imageBuffer,
									'linkedin-post-image.jpg'
								),
							3,
							context,
							'linkedin.uploadImageToLinkedIn'
						);
						context.log('Image successfully uploaded to LinkedIn');
					}
```
(Blob upload still happens in a dry-run so the preview can show an image; only the LinkedIn-facing upload is gated.)

- [ ] **Step 4: Re-run the flow tests**

Run:
```bash
cd api && npx vitest run tests/linkedInPostFlow.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add api/tests/linkedInPostFlow.test.ts api/src/flow/linkedin_post_flow.ts
git commit -m "test: prove dry-run never posts or persists; gate linkedin upload on post"
```

---

### Task 8: Turn on strict mode and fix the fallout

**Files:**
- Modify: `api/tsconfig.json`
- Modify: `api/src/service/CosmosService.ts`
- Modify: `api/src/service/OpenAiService.ts`

- [ ] **Step 1: Enable strict mode**

In `api/tsconfig.json`, change:
```json
    "strict": false
```
to:
```json
    "strict": true,
    "skipLibCheck": true
```
(`skipLibCheck` avoids strict errors leaking from third-party `.d.ts` files, which are not our code to fix.)

- [ ] **Step 2: See what breaks**

Run:
```bash
cd api && npx tsc --noEmit
```
Expected: a small number of `strictNullChecks` errors, primarily in `CosmosService.ts` (Cosmos `resource` is `T | undefined`) and `CosmosService.setContainer` (`process.env.COSMOS_DATABASE_ID` is `string | undefined`). Record the exact list.

- [ ] **Step 3: Fix `CosmosService` undefined-resource and env typing**

In `api/src/service/CosmosService.ts`:

(a) `createItem` — guard the possibly-undefined resource. Change:
```ts
			const { resource } = await this.container.items.create(item);
			return resource;
```
to:
```ts
			const { resource } = await this.container.items.create(item);
			if (!resource) {
				throw new Error('Cosmos create returned no resource');
			}
			return resource;
```

(b) `readItem` — same pattern. Change:
```ts
			const { resource } = await this.container
				.item(id, partitionKey)
				.read<T>();
			return resource;
```
to:
```ts
			const { resource } = await this.container
				.item(id, partitionKey)
				.read<T>();
			if (!resource) {
				throw new Error(`Cosmos item not found: ${id}`);
			}
			return resource;
```

(c) `setContainer` — validate the env var before use. Change:
```ts
		this.container = this.client
			.database(process.env.COSMOS_DATABASE_ID)
			.container(containerId);
```
to:
```ts
		const databaseId = process.env.COSMOS_DATABASE_ID;
		if (!databaseId) {
			throw new Error('COSMOS_DATABASE_ID is not set');
		}
		this.container = this.client.database(databaseId).container(containerId);
```

(d) The two catch blocks that read `error.message`/`error.stack` (in `queryItems` and `queryItemsWithPagination`) use an implicitly-typed `error`. If `tsc` flags them under strict, change `} catch (error) {` to `} catch (error: any) {` for those two blocks only (matching the explicit-any pattern already used elsewhere in the codebase for logging caught errors).

- [ ] **Step 4: Fix any remaining strict errors in `OpenAiService`**

Run `cd api && npx tsc --noEmit` again. If it flags `response.data[0]?.url` or `response.choices[0]?.message?.content` as possibly-undefined access, note that both already use optional chaining and fall back (`|| ''` / explicit `throw`), so they should pass. If a genuine new error appears, apply the same narrowing pattern: check for undefined and throw a descriptive error before use. Do not introduce `any` to silence a real null error; narrow it.

- [ ] **Step 5: Confirm a clean typecheck**

Run:
```bash
cd api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Confirm the build still emits**

Run:
```bash
cd api && npm run build
```
Expected: compiles, `dist/` produced, no errors.

- [ ] **Step 7: Run the full test suite**

Run:
```bash
cd api && npm test
```
Expected: all tests from Tasks 4, 5, and 7 pass (12 tests total).

- [ ] **Step 8: Commit**

```bash
git add api/tsconfig.json api/src/service/CosmosService.ts api/src/service/OpenAiService.ts
git commit -m "refactor: enable TypeScript strict mode and fix null-safety fallout"
```

---

### Task 9: Harden DALL-E env configuration (remove hardcoded endpoints)

**Files:**
- Modify: `api/src/service/OpenAiService.ts:170-191`

- [ ] **Step 1: Replace hardcoded fallbacks with required-env validation**

In `api/src/service/OpenAiService.ts`, inside `generateImage`, replace the block that sets East-region config with hardcoded fallbacks:
```ts
			// Use East region configuration for DALL-E 3
			const eastEndpoint =
				process.env.AZURE_OPENAI_ENDPOINT_EAST ||
				'https://djh-prod-ai-service-us-east.openai.azure.com/';
			const eastApiVersion =
				process.env.AZURE_OPENAI_API_VERSION_EAST || '2024-02-01';
			const dalleDeployment =
				process.env.AZURE_OPENAI_DALLE_DEPLOYMENT || 'dall-e-3';
			const eastApiKey =
				process.env.AZURE_OPENAI_API_KEY_EAST ||
				process.env.AZURE_OPENAI_API_KEY_WEST ||
				'';
```
with:
```ts
			// DALL-E 3 (East region) configuration, validated from environment.
			const eastEndpoint = process.env.AZURE_OPENAI_ENDPOINT_EAST;
			const eastApiVersion =
				process.env.AZURE_OPENAI_API_VERSION_EAST || '2024-02-01';
			const dalleDeployment =
				process.env.AZURE_OPENAI_DALLE_DEPLOYMENT || 'dall-e-3';
			const eastApiKey =
				process.env.AZURE_OPENAI_API_KEY_EAST ||
				process.env.AZURE_OPENAI_API_KEY_WEST;

			if (!eastEndpoint || !eastApiKey) {
				const missing = [
					!eastEndpoint && 'AZURE_OPENAI_ENDPOINT_EAST',
					!eastApiKey &&
						'AZURE_OPENAI_API_KEY_EAST or AZURE_OPENAI_API_KEY_WEST',
				]
					.filter(Boolean)
					.join(', ');
				throw new Error(
					`Missing required environment variables for DALL-E 3: ${missing}`
				);
			}
```
(API version and deployment keep sensible non-secret defaults; the endpoint and key, which are environment-specific, are now required. No personal resource URL remains in source.)

- [ ] **Step 2: Typecheck and build**

Run:
```bash
cd api && npx tsc --noEmit && npm run build
```
Expected: no errors. (`eastEndpoint`/`eastApiKey` are now `string` after the guard, satisfying the `AzureOpenAI` constructor under strict.)

- [ ] **Step 3: Run tests**

Run:
```bash
cd api && npm test
```
Expected: all pass (the image path is mocked in flow tests, so this change does not affect them).

- [ ] **Step 4: Commit**

```bash
git add api/src/service/OpenAiService.ts
git commit -m "refactor: require DALL-E endpoint/key from env, drop hardcoded fallbacks"
```

---

### Task 10: Gate CI on the real test suite

**Files:**
- Modify: `.github/workflows/main_auto-poster-function.yml:31-39`

- [ ] **Step 1: Make the build step run tests that can fail the build**

In `.github/workflows/main_auto-poster-function.yml`, replace the "Resolve Project Dependencies" step body:
```yaml
        run: |
          pushd './${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}'
          npm install
          npm run build --if-present
          npm run test --if-present
          popd
```
with:
```yaml
        run: |
          pushd './${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}'
          npm ci
          npm run typecheck
          npm test
          npm run build
          popd
```
Notes: `npm ci` is deterministic for CI; `npm test` (now `vitest run`) returns a nonzero exit on failure, which fails the job and blocks the deploy job that `needs: build`. The `--if-present` guards are removed so a missing script is a hard error, not a silent skip.

- [ ] **Step 2: Add a path filter so frontend-only changes (later phases) do not redeploy the backend**

In the same file, change the trigger:
```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:
```
to:
```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'api/**'
      - '.github/workflows/main_auto-poster-function.yml'
  workflow_dispatch:
```

- [ ] **Step 3: Validate the workflow YAML locally**

Run:
```bash
node -e "const y=require('fs').readFileSync('.github/workflows/main_auto-poster-function.yml','utf8'); console.log(y.includes('npm test') && y.includes('paths:') ? 'ok' : 'missing edits')"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/main_auto-poster-function.yml
git commit -m "ci: gate deploy on typecheck, tests, and build; filter to api paths"
```

---

### Task 11: Final verification

- [ ] **Step 1: Clean install and full check, as CI would run it**

Run:
```bash
cd api && npm ci && npm run typecheck && npm test && npm run build
```
Expected: install succeeds; typecheck clean; all 12 tests pass; build emits `dist/`.

- [ ] **Step 2: Confirm the working tree is committed**

Run:
```bash
git status
```
Expected: "nothing to commit, working tree clean".

- [ ] **Step 3: Review the commit series**

Run:
```bash
git log --oneline -11
```
Expected: the Task 1-10 commits plus the earlier design-doc commit, in order.

---

## Self-review notes

- **Spec coverage:** This plan covers the spec's "Quality pass on existing code" (strict mode, TS 5, drop `@types/axios`, env hardening, `setContainer` fix), the `linkedInPostFlow` options-object refactor, the backend test suite (`retryUtil`, type guard, `getContentType`, dry-run contract, full-run contract), and the CI test gate + path filter. The `generate_preview`/`get_posts` handler tests are intentionally deferred to the Phase 2 plan since those handlers do not exist yet.
- **Dry-run guarantee:** Task 7 + Task 6 together enforce that `post: false` reaches neither `postToLinkedIn` nor `uploadImageToLinkedIn`, and `persist: false` reaches neither `createItem`. This is the safety property the public demo depends on.
- **Type consistency:** `LinkedInPostFlowOptions { triggerBy, post, persist, generateImage }` is defined in Task 6 and used identically in Tasks 6 and 7 and by all call sites.
- **No placeholders:** every code step shows the exact before/after; every run step shows the command and expected result.
```
