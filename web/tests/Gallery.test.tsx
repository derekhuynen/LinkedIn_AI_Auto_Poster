import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostsResponse } from '@/lib/types';

const mocks = vi.hoisted(() => ({ getPosts: vi.fn() }));
vi.mock('@/lib/api', () => ({ getPosts: mocks.getPosts }));

import Gallery from '@/components/Gallery';

const PAGE_1: PostsResponse = {
	posts: [
		{
			topic: 'Why Idempotency Keys Belong in Every Write API',
			linkedInPost: 'Most outages I have debugged were not caused by the failure itself.',
			blobStorageUrl: '/samples/feed-01.svg',
			createdAt: '2026-05-28T09:00:00.000Z',
			triggerBy: 'timer',
		},
	],
	continuationToken: 'tok-abc',
};

const PAGE_2: PostsResponse = {
	posts: [
		{
			topic: 'Vector Databases Are Just Indexes With Better PR',
			linkedInPost: 'Every team I talk to wants a vector database.',
			blobStorageUrl: '/samples/feed-02.svg',
			createdAt: '2026-05-27T09:00:00.000Z',
			triggerBy: 'timer',
		},
	],
	continuationToken: undefined,
};

describe('Gallery', () => {
	beforeEach(() => vi.clearAllMocks());

	it('renders post cards when getPosts resolves with posts', async () => {
		mocks.getPosts.mockResolvedValue(PAGE_1);
		render(<Gallery />);
		expect(
			await screen.findByText('Why Idempotency Keys Belong in Every Write API')
		).toBeInTheDocument();
	});

	it('shows the empty-state notice when getPosts resolves with no posts', async () => {
		mocks.getPosts.mockResolvedValue({ posts: [], continuationToken: undefined });
		render(<Gallery />);
		expect(
			await screen.findByText(/no posts yet/i)
		).toBeInTheDocument();
	});

	it('shows an error notice when getPosts rejects', async () => {
		mocks.getPosts.mockRejectedValue(new Error('network error'));
		render(<Gallery />);
		expect(
			await screen.findByText(/could not reach the feed/i)
		).toBeInTheDocument();
	});

	it('shows a Load more button when a continuationToken is returned and appends posts on click', async () => {
		mocks.getPosts
			.mockResolvedValueOnce(PAGE_1)
			.mockResolvedValueOnce(PAGE_2);

		render(<Gallery />);

		// First page renders
		await screen.findByText('Why Idempotency Keys Belong in Every Write API');

		// Load more button should appear because PAGE_1 has a continuationToken
		const loadMoreBtn = await screen.findByRole('button', { name: /load more/i });
		expect(loadMoreBtn).toBeInTheDocument();

		// Click it
		await userEvent.click(loadMoreBtn);

		// Second page topic should appear
		expect(
			await screen.findByText('Vector Databases Are Just Indexes With Better PR')
		).toBeInTheDocument();

		// getPosts was called twice: once on mount, once for load more
		expect(mocks.getPosts).toHaveBeenCalledTimes(2);
		// Second call should include the token from PAGE_1
		expect(mocks.getPosts).toHaveBeenNthCalledWith(2, 12, 'tok-abc');

		// Load more button should be gone (PAGE_2 has no token)
		expect(
			screen.queryByRole('button', { name: /load more/i })
		).not.toBeInTheDocument();
	});
});
