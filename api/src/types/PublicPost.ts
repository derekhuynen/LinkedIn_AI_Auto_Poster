/**
 * The public-safe shape of a post returned by GET /api/posts and POST /api/preview.
 * Excludes internal/secret fields (LinkedIn asset URN, raw research).
 */
export type PublicPost = {
	topic: string;
	topicDescription?: string;
	linkedInPost: string;
	blobStorageUrl?: string;
	createdAt: string;
	triggerBy?: string;
};
