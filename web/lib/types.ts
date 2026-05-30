/** Mirrors api/src/types/PublicPost.ts */
export type PublicPost = {
	topic: string;
	topicDescription?: string;
	linkedInPost: string;
	blobStorageUrl?: string;
	createdAt: string;
	triggerBy?: string;
};

export type PostsResponse = {
	posts: PublicPost[];
	continuationToken?: string;
};

/** Shape returned by POST /api/preview on success. */
export type PreviewResult = {
	topic: string;
	topicDescription?: string;
	linkedInPost: string;
	imageUrl?: string;
	createdAt: string;
	remaining: number;
};

/** Thrown when the daily demo cap is hit (HTTP 429). */
export class RateLimitError extends Error {
	resetsAt: string;
	constructor(message: string, resetsAt: string) {
		super(message);
		this.name = 'RateLimitError';
		this.resetsAt = resetsAt;
	}
}
