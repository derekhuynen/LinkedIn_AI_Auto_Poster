import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostModal from '@/components/PostModal';
import { PublicPost } from '@/lib/types';

const POST: PublicPost = {
	topic: 'Backpressure Is a Feature, Not a Bug',
	topicDescription: 'Why letting a queue say no protects the whole system.',
	linkedInPost:
		'A queue that never pushes back is a queue that is lying to you.\n\nWhen producers outpace consumers, latency climbs until the pipeline tips over.',
	blobStorageUrl: '/samples/feed-02.svg',
	createdAt: '2026-05-27T09:00:00.000Z',
	triggerBy: 'timer',
};

describe('PostModal', () => {
	it('renders the full post in a dialog', () => {
		render(<PostModal post={POST} onClose={() => {}} />);
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText(POST.topic)).toBeInTheDocument();
		// The full body (including the second paragraph) is shown, not clamped.
		expect(screen.getByText(/the pipeline tips over/i)).toBeInTheDocument();
		expect(screen.getByAltText(/cover image for/i)).toBeInTheDocument();
	});

	it('calls onClose when the close button is clicked', async () => {
		const onClose = vi.fn();
		render(<PostModal post={POST} onClose={onClose} />);
		await userEvent.click(screen.getByRole('button', { name: /close/i }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when Escape is pressed', async () => {
		const onClose = vi.fn();
		render(<PostModal post={POST} onClose={onClose} />);
		await userEvent.keyboard('{Escape}');
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
