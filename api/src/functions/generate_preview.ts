import {
	app,
	HttpRequest,
	HttpResponseInit,
	InvocationContext,
} from '@azure/functions';
import { createHash } from 'crypto';
import { RateLimitService } from '../service/RateLimitService';
import { linkedInPostFlow } from '../flow/linkedin_post_flow';
import {
	getDryRunDailyCap,
	getDryRunPerIpHourlyCap,
} from '../constants/constants';

/** UTC `YYYY-MM-DD` for the given date. */
function utcDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** UTC `YYYY-MM-DDTHH` window key for per-IP hourly limiting. */
function utcHour(date: Date): string {
	return date.toISOString().slice(0, 13);
}

/** A privacy-preserving per-IP key (hashed; raw IP is never stored). */
function clientIpKey(request: HttpRequest, date: Date): string {
	const fwd = request.headers.get('x-forwarded-for') || '';
	const ip = fwd.split(',')[0].trim() || 'unknown';
	const hash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
	return `ip-${hash}-${utcHour(date)}`;
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

		// Per-IP hourly limit first, so one visitor cannot exhaust the global cap.
		// The counter is keyed to the current UTC hour and self-expires via TTL.
		const perIp = await rateLimiter.checkAndIncrement(
			clientIpKey(request, now),
			getDryRunPerIpHourlyCap(),
			2 * 60 * 60
		);
		if (!perIp.allowed) {
			return {
				status: 429,
				jsonBody: {
					error: 'Too many requests from your network. Please try again shortly.',
					resetsAt: new Date(
						Date.UTC(
							now.getUTCFullYear(),
							now.getUTCMonth(),
							now.getUTCDate(),
							now.getUTCHours() + 1
						)
					).toISOString(),
				},
			};
		}

		const limit = await rateLimiter.checkAndIncrement(
			`dryrun-${utcDay(now)}`,
			cap
		);

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
