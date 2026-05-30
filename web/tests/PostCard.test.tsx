import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('PostCard', () => {
	it('renders the topic as a heading', () => {
		render(<PostCard post={BASE_POST} />);
		expect(
			screen.getByRole('heading', { name: /why idempotency keys/i })
		).toBeInTheDocument();
	});

	it('renders a substring of the post body', () => {
		render(<PostCard post={BASE_POST} />);
		expect(screen.getByText(/were caused by the retry/i)).toBeInTheDocument();
	});

	it('renders the triggerBy tag', () => {
		render(<PostCard post={BASE_POST} />);
		expect(screen.getByText('timer')).toBeInTheDocument();
	});

	it('renders the formatted year in the date footer', () => {
		render(<PostCard post={BASE_POST} />);
		// toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
		// => something like "May 28, 2026"
		expect(screen.getByText(/2026/)).toBeInTheDocument();
	});

	it('renders an img element when blobStorageUrl is set', () => {
		render(<PostCard post={BASE_POST} />);
		// The img has alt="" so its ARIA role is "presentation"; query by alt text directly.
		const img = screen.getByAltText('');
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute('src', '/samples/feed-01.svg');
	});

	it('does not render an img element when blobStorageUrl is absent', () => {
		const { blobStorageUrl: _omitted, ...postWithoutImage } = BASE_POST;
		render(<PostCard post={postWithoutImage} />);
		// No img at all in the DOM when blobStorageUrl is absent.
		expect(document.querySelector('img')).toBeNull();
	});

	it('does not render the triggerBy tag when triggerBy is absent', () => {
		const { triggerBy: _omitted, ...postWithoutTrigger } = BASE_POST;
		render(<PostCard post={postWithoutTrigger} />);
		expect(screen.queryByText('timer')).not.toBeInTheDocument();
	});
});
