export enum OpenAIModels {
	GPT_4_1 = 'GPT_4_1',
	DALLE_3 = 'DALLE_3',
}

export function getModelDetails(model: OpenAIModels): {
	modelName: string;
	deployment: string;
} {
	// Get environment variables for deployments if available, otherwise use defaults
	const gpt4Deployment = process.env.AZURE_OPENAI_GPT_DEPLOYMENT || 'gpt-4.1';
	const dalleDeployment =
		process.env.AZURE_OPENAI_DALLE_DEPLOYMENT || 'dall-e-3';

	switch (model) {
		case OpenAIModels.GPT_4_1:
			return { modelName: 'gpt-4.1', deployment: gpt4Deployment };
		case OpenAIModels.DALLE_3:
			return { modelName: 'dall-e-3', deployment: dalleDeployment };
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

/** Cosmos container holding per-day dry-run counters. */
export function getRateLimitContainerId(): string {
	return process.env.COSMOS_RATELIMIT_CONTAINER || 'RateLimits';
}

export * from './dalle3_config';

