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

export * from './dalle3_config';
