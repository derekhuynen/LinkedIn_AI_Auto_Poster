import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	checkAndIncrement: vi.fn(),
	linkedInPostFlow: vi.fn(),
}));

vi.mock('../src/service/RateLimitService', () => ({
	RateLimitService: class {
		checkAndIncrement = mocks.checkAndIncrement;
	},
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
