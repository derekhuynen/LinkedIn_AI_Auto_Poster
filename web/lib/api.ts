import { PostsResponse, PreviewResult, RateLimitError } from './types';
import { SAMPLE_POSTS, SAMPLE_PREVIEW } from './sampleData';

const USE_SAMPLE = process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === 'true';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Fetches a page of the public gallery. */
export async function getPosts(
	limit = 12,
	continuationToken?: string
): Promise<PostsResponse> {
	if (USE_SAMPLE) {
		await delay(400);
		return SAMPLE_POSTS;
	}
	const params = new URLSearchParams({ limit: String(limit) });
	if (continuationToken) params.set('continuationToken', continuationToken);
	const res = await fetch(`${API_BASE}/api/posts?${params.toString()}`);
	if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
	return (await res.json()) as PostsResponse;
}

/** Triggers a live dry-run. Throws RateLimitError on 429. */
export async function generatePreview(): Promise<PreviewResult> {
	if (USE_SAMPLE) {
		await delay(1800);
		return SAMPLE_PREVIEW;
	}
	const res = await fetch(`${API_BASE}/api/preview`, { method: 'POST' });
	if (res.status === 429) {
		const body = await res.json().catch(() => ({}));
		throw new RateLimitError(
			body.error ?? 'Daily demo limit reached.',
			body.resetsAt ?? ''
		);
	}
	if (!res.ok) throw new Error(`Failed to generate preview (${res.status})`);
	return (await res.json()) as PreviewResult;
}
