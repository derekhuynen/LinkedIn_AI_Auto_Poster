import { InvocationContext, trigger } from '@azure/functions';
import { OpenAiService } from '../service/OpenAiService';
import {
	getModelDetails,
	OpenAIModels,
	GENERATE_TOPIC_PROMPT_PATH,
	GENERATE_LINKEDIN_POST_PROMPT_PATH,
	GENERATE_IMAGE_PROMPT_PATH,
	PAST_POSTS_COUNT,
	LINKEDIN_IMAGE_DEFAULTS,
} from '../constants/constants';
import { MdService } from '../service/MdService';
import LinkedinService from '../service/LinkedinService';
import { CosmosService } from '../service/CosmosService';
import { BlobStorageService } from '../service/BlobStorageService';
import { Post } from '../types/Post';
import { withRetry } from '../service/retryUtil';

const generateTopicPrompt = MdService.readMarkdownFile(
	GENERATE_TOPIC_PROMPT_PATH
);
const generateLinkedInPostPrompt = MdService.readMarkdownFile(
	GENERATE_LINKEDIN_POST_PROMPT_PATH
);
const generateImagePrompt = MdService.readMarkdownFile(
	GENERATE_IMAGE_PROMPT_PATH
);

type GenerateTopicPromptResponse = {
	topic: string;
	topic_description: string;
	research: string;
};

function isGenerateTopicPromptResponse(
	obj: any
): obj is GenerateTopicPromptResponse {
	return (
		obj &&
		typeof obj === 'object' &&
		typeof obj.topic === 'string' &&
		typeof obj.topic_description === 'string' &&
		typeof obj.research === 'string'
	);
}

/**
 * Orchestrates the workflow for generating and posting a LinkedIn post using Azure OpenAI, DALL-E, Blob Storage, and Cosmos DB.
 * Handles topic and content generation, image creation, LinkedIn posting, and Cosmos DB storage with robust error handling and retries.
 *
 * @param {InvocationContext} context - The Azure Functions invocation context for logging
 * @param {string} triggerBy - What triggered the workflow (e.g., 'timer', 'http')
 * @returns {Promise<{topic: string, topicDescription: string, research: string, linkedInPost: string, createdAt: string, triggerBy: string, imageUrl?: string, blobStorageUrl?: string, imageAsset?: string, imagePrompt?: string}>} The workflow result and metadata
 * @throws {Error} If any critical step fails
 */
export async function linkedInPostFlow(
	context: InvocationContext,
	triggerBy: string
): Promise<{
	topic: string;
	topicDescription: string;
	research: string;
	linkedInPost: string;
	createdAt: string;
	triggerBy: string;
	imageUrl?: string;
	blobStorageUrl?: string;
	imageAsset?: string;
	imagePrompt?: string;
}> {
	const containerId = process.env.COSMOS_LINKEDIN_CONTAINER || '';

	// Improved error handling and logging
	if (!containerId) {
		const errorMessage =
			'COSMOS_LINKEDIN_CONTAINER environment variable is not set';
		context.log(errorMessage);
		throw new Error(errorMessage);
	}

	const { modelName, deployment } = getModelDetails(OpenAIModels.GPT_4_1);
	const openAiService = new OpenAiService(modelName, deployment);
	const linkedinService = new LinkedinService();
	const cosmosService = new CosmosService({
		containerId: containerId,
	});
	const blobStorageService = new BlobStorageService();

	// Assign createdAt to a variable to avoid redundancy
	const createdAt = new Date().toISOString();

	try {
		// Step 0: Grab last N posts and ensure no topic repetition
		const lastPostsQuery = `SELECT TOP ${PAST_POSTS_COUNT} * FROM c WHERE c.topic != null ORDER BY c.createdAt DESC`;
		const lastPosts = (await withRetry(
			() => cosmosService.queryItems(lastPostsQuery),
			3,
			context,
			'cosmos.queryItems'
		)) as Post[];

		// Step 1: Generate a topic: should return type GenerateTopicPromptResponse
		const topicResponse = await withRetry(
			() =>
				openAiService.generateResponse({
					model: modelName,
					prompt: generateTopicPrompt,
					userMessage: `## PAST TOPICS ## \n Please avoid repeating topics from the previous posts: \n\n${lastPosts
						.map(post => post.topic)
						.join(', ')}`,
				}),
			3,
			context,
			'openai.generateTopic'
		);
		let topicData: GenerateTopicPromptResponse;
		try {
			topicData = JSON.parse(topicResponse);
		} catch (err: any) {
			context.log('Failed to parse OpenAI topic response:', topicResponse);
			throw new Error('OpenAI topic response is not valid JSON');
		}
		if (!isGenerateTopicPromptResponse(topicData)) {
			context.log('OpenAI topic response failed to type guard:', topicData);
			throw new Error('OpenAI topic response does not match expected schema');
		}

		// Step 2: Generate LinkedIn post and image in parallel for better performance
		let linkedInPost: string;
		let imagePromptResponse: string = '';
		if (process.env.ENABLE_IMAGE_PROMPT_GENERATION !== 'false') {
			[linkedInPost, imagePromptResponse] = await Promise.all([
				withRetry(
					() =>
						openAiService.generateResponse({
							model: modelName,
							prompt: generateLinkedInPostPrompt,
							userMessage: `### TOPIC ## \n ${topicData.topic} \n### TOPIC DESCRIPTION ## \n ${topicData.topic_description} \n### RESEARCH ## \n ${topicData.research} \n`,
						}),
					3,
					context,
					'openai.generateLinkedInPost'
				),
				withRetry(
					() =>
						openAiService.generateResponse({
							model: modelName,
							prompt: generateImagePrompt,
							userMessage: `**Topic**: ${topicData.topic}\n**Topic Description**: ${topicData.topic_description}`,
						}),
					3,
					context,
					'openai.generateImagePrompt'
				),
			]);
		} else {
			linkedInPost = await withRetry(
				() =>
					openAiService.generateResponse({
						model: modelName,
						prompt: generateLinkedInPostPrompt,
						userMessage: `### TOPIC ## \n ${topicData.topic} \n### TOPIC DESCRIPTION ## \n ${topicData.topic_description} \n### RESEARCH ## \n ${topicData.research} \n`,
					}),
				3,
				context,
				'openai.generateLinkedInPost'
			);
		}

		// Step 3: Generate image using DALL-E 3
		let imageUrl: string | undefined;
		let blobStorageUrl: string | undefined;
		let imageAsset: string | undefined;

		try {
			if (process.env.ENABLE_IMAGE_GENERATION === 'true') {
				context.log('Generating image with DALL-E 3...');
				imageUrl = await withRetry(
					() =>
						openAiService.generateImage({
							prompt: imagePromptResponse,
							size: LINKEDIN_IMAGE_DEFAULTS.size,
							quality: LINKEDIN_IMAGE_DEFAULTS.quality,
							style: LINKEDIN_IMAGE_DEFAULTS.style,
						}),
					3,
					context,
					'openai.generateImage'
				);

				if (imageUrl) {
					const imageBuffer = await withRetry(
						() => openAiService.downloadImageAsBuffer(imageUrl!),
						3,
						context,
						'openai.downloadImageAsBuffer'
					);

					context.log('Uploading image to Azure Blob Storage...');
					blobStorageUrl = await withRetry(
						() =>
							blobStorageService.uploadImage(
								imageBuffer,
								`linkedin-post-${Date.now()}.jpg`
							),
						3,
						context,
						'blob.uploadImage'
					);
					context.log('Image uploaded to Blob Storage:', blobStorageUrl);

					imageAsset = await withRetry(
						() =>
							linkedinService.uploadImageToLinkedIn(
								imageBuffer,
								'linkedin-post-image.jpg'
							),
						3,
						context,
						'linkedin.uploadImageToLinkedIn'
					);
					context.log('Image successfully uploaded to LinkedIn');
				}
			} else {
				context.log('Image generation is disabled. Skipping image creation.');
			}
		} catch (imageError: any) {
			context.log(
				'Warning: Image generation failed, continuing without image:',
				imageError.message
			);
			// Continue without image - don't fail the entire process
		}

		// Step 4: Post to LinkedIn (toggle with a flag for local testing)
		if (process.env.ENABLE_LINKEDIN_POST === 'true') {
			await withRetry(
				() => linkedinService.postToLinkedIn(linkedInPost, imageAsset),
				3,
				context,
				'linkedin.postToLinkedIn'
			);
		} else {
			context.log('LinkedIn posting is disabled. Skipping Step 4.');
		}
		// Step 5: Save the LinkedIn post to Cosmos DB
		await withRetry(
			() =>
				cosmosService.createItem({
					topic: topicData.topic,
					topicDescription: topicData.topic_description,
					research: topicData.research,
					linkedInPost: linkedInPost,
					createdAt: createdAt,
					triggerBy: triggerBy,
					imageUrl: imageUrl,
					blobStorageUrl: blobStorageUrl,
					imageAsset: imageAsset,
					imagePrompt: imagePromptResponse,
				}),
			3,
			context,
			'cosmos.createItem'
		);
		return {
			topic: topicData.topic,
			topicDescription: topicData.topic_description,
			research: topicData.research,
			linkedInPost: linkedInPost,
			createdAt: createdAt,
			triggerBy: triggerBy,
			imageUrl: imageUrl,
			blobStorageUrl: blobStorageUrl,
			imageAsset: imageAsset,
			imagePrompt: imagePromptResponse,
		};
	} catch (error: any) {
		context.log('Error generating or posting LinkedIn post', error);
		throw new Error(
			`Failed to generate or post LinkedIn post: ${error.message}`
		);
	}
}
