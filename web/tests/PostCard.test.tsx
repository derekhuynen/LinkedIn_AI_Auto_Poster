import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostCard from '@/components/PostCard';
import { PublicPost } from '@/lib/types';

const BASE_POST: PublicPost = {
	topic: 'Why Idempotency Keys Belong in Every Write API',
	linkedInPost:
		'Most outages I have debugged were not caused by the failure itself. They were caused by the retry.',
	blobStorageUrl: '/samples/feed-01.svg',
	createdAt: '2026-05-28T09:00:00.000Z',
	triggerBy: 'timer',
};

const noop = () => {};

describe('PostCard', () => {
	it('renders the topic as a heading', () => {
		render(<PostCard post={BASE_POST} onSelect={noop} />);
		expect(
			screen.getByRole('heading', { name: /why idempotency keys/i })
		).toBeInTheDocument();
	});

	it('renders a substring of the post body', () => {
		render(<PostCard post={BASE_POST} onSelect={noop} />);
		expect(screen.getByText(/were caused by the retry/i)).toBeInTheDocument();
	});

	it('renders the triggerBy tag', () => {
		render(<PostCard post={BASE_POST} onSelect={noop} />);
		expect(screen.getByText('timer')).toBeInTheDocument();
	});

	it('renders the formatted year in the date footer', () => {
		render(<PostCard post={BASE_POST} onSelect={noop} />);
		expect(screen.getByText(/2026/)).toBeInTheDocument();
	});

	it('renders the cover img with a descriptive alt when blobStorageUrl is set', () => {
		render(<PostCard post={BASE_POST} onSelect={noop} />);
		const img = screen.getByAltText(/cover image for/i);
		expect(img).toHaveAttribute('src', '/samples/feed-01.svg');
	});

	it('does not render an img element when blobStorageUrl is absent', () => {
		const postWithoutImage: PublicPost = { ...BASE_POST, blobStorageUrl: undefined };
		render(<PostCard post={postWithoutImage} onSelect={noop} />);
		expect(document.querySelector('img')).toBeNull();
	});

	it('calls onSelect when the card is clicked', async () => {
		const onSelect = vi.fn();
		render(<PostCard post={BASE_POST} onSelect={onSelect} />);
		await userEvent.click(
			screen.getByRole('button', { name: /read post: why idempotency/i })
		);
		expect(onSelect).toHaveBeenCalledTimes(1);
	});
});
