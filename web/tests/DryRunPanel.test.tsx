import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ generatePreview: vi.fn() }));
vi.mock('@/lib/api', () => ({ generatePreview: mocks.generatePreview }));

import DryRunPanel from '@/components/DryRunPanel';
import { RateLimitError } from '@/lib/types';

describe('DryRunPanel', () => {
	beforeEach(() => vi.clearAllMocks());

	it('shows the generated post and remaining quota on success', async () => {
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
		expect(screen.getByText(/49 demo generations left today/i)).toBeInTheDocument();
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
