import { PostsResponse, PreviewResult, PublicPost } from './types';
import examples from './examples.json';

// Stable, descending sample dates so local sample-mode mirrors the deployed gallery.
const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.UTC(2026, 4, 30);

export const SAMPLE_POSTS: PostsResponse = {
	posts: examples.map(
		(ex, i): PublicPost => ({
			topic: ex.topic,
			topicDescription: ex.topicDescription,
			linkedInPost: ex.linkedInPost,
			blobStorageUrl: `/samples/${ex.image}`,
			createdAt: new Date(BASE - i * DAY).toISOString(),
			triggerBy: 'timer',
		})
	),
	continuationToken: undefined,
};

export const SAMPLE_PREVIEW: PreviewResult = {
	topic: examples[0].topic,
	topicDescription: examples[0].topicDescription,
	linkedInPost: examples[0].linkedInPost,
	imageUrl: `/samples/${examples[0].image}`,
	createdAt: new Date(BASE).toISOString(),
	remaining: 49,
};
