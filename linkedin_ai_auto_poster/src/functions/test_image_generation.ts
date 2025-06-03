import {
	app,
	HttpRequest,
	HttpResponseInit,
	InvocationContext,
} from '@azure/functions';
import { OpenAiService } from '../service/OpenAiService';
import { MdService } from '../service/MdService';
import LinkedinService from '../service/LinkedinService';
import { getModelDetails, OpenAIModels } from '../constants/constants';
import { withRetry } from '../service/retryUtil';

const generateImagePrompt = MdService.readMarkdownFile(
	'../prompts/generate_linkedin_image_prompt.md'
);

/**
 * Azure Function to test DALL-E 3 image generation and optional LinkedIn image upload.
 * Uses OpenAI to generate an image prompt and image, and optionally uploads the image to LinkedIn.
 *
 * @param {HttpRequest} request - The HTTP request object
 * @param {InvocationContext} context - The Azure Functions invocation context for logging
 * @returns {Promise<HttpResponseInit>} The HTTP response with test results or error details
 */
export async function testImageGeneration(
	request: HttpRequest,
	context: InvocationContext
): Promise<HttpResponseInit> {
	context.log('Testing DALL-E 3 image generation...');
	try {
		if (process.env.ENABLE_IMAGE_GENERATION_TEST === 'false') {
			context.log(
				'Image generation test endpoint is disabled by feature flag.'
			);
			return {
				status: 403,
				jsonBody: {
					success: false,
					message:
						'Image generation test endpoint is disabled by feature flag.',
				},
			};
		}

		const { modelName, deployment } = getModelDetails(OpenAIModels.GPT_4_1);
		const openAiService = new OpenAiService(modelName, deployment);
		const linkedinService = new LinkedinService();

		const testTopic = 'The Future of AI in Software Development';
		const testTopicDescription =
			'Exploring how artificial intelligence is transforming the way we write, test, and deploy software applications.';

		const imagePromptResponse = await withRetry(
			() =>
				openAiService.generateResponse({
					model: modelName,
					prompt: generateImagePrompt,
					userMessage: `**Topic**: ${testTopic}\n**Topic Description**: ${testTopicDescription}`,
				}),
			3,
			context,
			'openai.generateImagePrompt'
		);

		context.log('Generated image prompt:', imagePromptResponse);

		const imageUrl = await withRetry(
			() =>
				openAiService.generateImage({
					prompt: imagePromptResponse,
					size: '1792x1024',
					quality: 'standard',
					style: 'vivid',
				}),
			3,
			context,
			'openai.generateImage'
		);

		context.log('Generated image URL:', imageUrl);

		let imageAsset: string | undefined;
		if (process.env.ENABLE_LINKEDIN_POST === 'true') {
			const imageBuffer = await withRetry(
				() => openAiService.downloadImageAsBuffer(imageUrl),
				3,
				context,
				'openai.downloadImageAsBuffer'
			);
			imageAsset = await withRetry(
				() =>
					linkedinService.uploadImageToLinkedIn(imageBuffer, 'test-image.jpg'),
				3,
				context,
				'linkedin.uploadImageToLinkedIn'
			);
			context.log('Uploaded image asset:', imageAsset);
		}

		return {
			status: 200,
			jsonBody: {
				success: true,
				message: 'Image generation test completed successfully',
				data: {
					topic: testTopic,
					imagePrompt: imagePromptResponse,
					imageUrl: imageUrl,
					imageAsset: imageAsset,
				},
			},
		};
	} catch (error: any) {
		context.log('Error in image generation test:', error);
		return {
			status: 500,
			jsonBody: {
				success: false,
				error: error.message,
				message: 'Image generation test failed',
			},
		};
	}
}

app.http('test_image_generation', {
	methods: ['GET'],
	authLevel: 'anonymous',
	handler: testImageGeneration,
});
