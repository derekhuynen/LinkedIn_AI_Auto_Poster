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

		// The cap unit is consumed above and intentionally NOT refunded if
		// generation fails below: a failed attempt still spent OpenAI budget, and
		// refunding would let a forced-failure loop bypass the cap.
		const result = await linkedInPostFlow(context, {
			triggerBy: 'preview',
			post: false,
			persist: false,
			// Honor the same image toggle as the timer path, so the preview does
			// not attempt image generation when no image model is deployed.
			generateImage: process.env.ENABLE_IMAGE_GENERATION === 'true',
		});

		return {
			status: 200,
			jsonBody: {
				topic: result.topic,
				topicDescription: result.topicDescription,
				linkedInPost: result.linkedInPost,
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
