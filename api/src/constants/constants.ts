export enum OpenAIModels {
	/** Text model for topic and post generation. */
	GPT = 'GPT',
	/** Image model for cover generation. */
	IMAGE = 'IMAGE',
}

/**
 * Resolves the Azure deployment name for a model from the environment. On Azure
 * OpenAI the request is routed by deployment name, so modelName === deployment.
 * Defaults track current models (gpt-5-mini for text, gpt-image-1 for images).
 */
export function getModelDetails(model: OpenAIModels): {
	modelName: string;
	deployment: string;
} {
	switch (model) {
		case OpenAIModels.GPT: {
			const deployment =
				process.env.AZURE_OPENAI_GPT_DEPLOYMENT || 'gpt-5-mini';
			return { modelName: deployment, deployment };
		}
		case OpenAIModels.IMAGE: {
			const deployment =
				process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || 'gpt-image-1';
			return { modelName: deployment, deployment };
		}
		default:
			throw new Error('Unsupported model');
	}
}

// Prompt .md file paths
export const GENERATE_TOPIC_PROMPT_PATH =
	'../prompts/generate_topic_derek_huynen.md';
export const GENERATE_LINKEDIN_POST_PROMPT_PATH =
	'../prompts/generate_linkedin_post_derek_huynen.md';
export const GENERATE_IMAGE_PROMPT_PATH =
	'../prompts/generate_linkedin_image_prompt.md';

// Number of past posts to check for topic repetition
export const PAST_POSTS_COUNT = 7;

// Public gallery feed: newest real auto-posts first. Projects only public-safe
// fields so secrets never leave Cosmos. Excludes rate-limit counter docs
// (which have no `topic`) via the WHERE clause.
export const PUBLIC_POSTS_QUERY =
	'SELECT c.topic, c.topicDescription, c.linkedInPost, c.blobStorageUrl, c.createdAt, c.triggerBy FROM c WHERE c.topic != null ORDER BY c.createdAt DESC';

// Default number of gallery items per page.
export const DEFAULT_POSTS_PAGE_SIZE = 12;

/** Global daily cap on /api/preview dry-runs. */
export function getDryRunDailyCap(): number {
	const raw = process.env.DRYRUN_DAILY_CAP;
	const parsed = raw ? parseInt(raw, 10) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

/** Per-IP hourly cap on /api/preview dry-runs (abuse protection). */
export function getDryRunPerIpHourlyCap(): number {
	const raw = process.env.DRYRUN_PER_IP_HOURLY_CAP;
	const parsed = raw ? parseInt(raw, 10) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

/** Cosmos container holding per-day dry-run counters. */
export function getRateLimitContainerId(): string {
	return process.env.COSMOS_RATELIMIT_CONTAINER || 'RateLimits';
}

export * from './image_config';
