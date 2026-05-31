import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SAMPLE_POSTS, SAMPLE_PREVIEW } from '@/lib/sampleData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dynamically import the api module so each describe block gets a fresh copy
 * with the env vars that were set before the import. */
async function importApi() {
	const mod = await import('@/lib/api');
	return mod;
}

/** Dynamically import types so the RateLimitError class is from the same module
 * registry as the api module (needed after vi.resetModules()). */
async function importTypes() {
	const mod = await import('@/lib/types');
	return mod;
}

// ---------------------------------------------------------------------------
// Sample-data mode
// ---------------------------------------------------------------------------

describe('api – sample mode', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv('NEXT_PUBLIC_USE_SAMPLE_DATA', 'true');
		// Speed up the 400ms delay so tests stay fast
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
	});

	it('getPosts() returns the sample posts', async () => {
		const { getPosts } = await importApi();
		const promise = getPosts();
		// advance past the 400ms delay
		await vi.advanceTimersByTimeAsync(500);
		const result = await promise;
		expect(result).toEqual(SAMPLE_POSTS);
	});

	it('generatePreview() returns the sample preview', async () => {
		const { generatePreview } = await importApi();
		const promise = generatePreview();
		// advance past the 1800ms delay
		await vi.advanceTimersByTimeAsync(2000);
		const result = await promise;
		expect(result).toEqual(SAMPLE_PREVIEW);
	});
});

// ---------------------------------------------------------------------------
// Live mode
// ---------------------------------------------------------------------------

describe('api – live mode', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv('NEXT_PUBLIC_USE_SAMPLE_DATA', 'false');
		vi.stubEnv('NEXT_PUBLIC_API_BASE', 'https://example.com');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('getPosts() parses and returns the JSON body on success', async () => {
		const fakeResponse: import('@/lib/types').PostsResponse = {
			posts: [
				{
					topic: 'Live topic',
					linkedInPost: 'Live post body',
					createdAt: '2026-05-28T09:00:00.000Z',
				},
			],
			continuationToken: undefined,
		};

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(fakeResponse),
			})
		);

		const { getPosts } = await importApi();
		const result = await getPosts();
		expect(result).toEqual(fakeResponse);
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('/api/posts')
		);
	});

	it('getPosts() throws on a non-ok response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.resolve({}),
			})
		);

		const { getPosts } = await importApi();
		await expect(getPosts()).rejects.toThrow('Failed to load posts (500)');
	});

	it('generatePreview() throws RateLimitError on HTTP 429', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 429,
				json: () =>
					Promise.resolve({
						error: 'Daily demo limit reached.',
						resetsAt: '2026-05-30T00:00:00.000Z',
					}),
			})
		);

		const { generatePreview } = await importApi();
		const { RateLimitError } = await importTypes();
		await expect(generatePreview()).rejects.toBeInstanceOf(RateLimitError);
	});

	it('generatePreview() RateLimitError carries the correct message and resetsAt', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 429,
				json: () =>
					Promise.resolve({
						error: 'Daily demo limit reached.',
						resetsAt: '2026-05-30T00:00:00.000Z',
					}),
			})
		);

		const { generatePreview } = await importApi();
		const { RateLimitError } = await importTypes();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let caught: any;
		try {
			await generatePreview();
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(RateLimitError);
		expect(caught?.message).toBe('Daily demo limit reached.');
		expect(caught?.resetsAt).toBe('2026-05-30T00:00:00.000Z');
	});
});
