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
