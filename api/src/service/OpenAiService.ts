import { AzureOpenAI } from 'openai';
import { getModelDetails, OpenAIModels } from '../constants/constants';

/**
 * Service for interacting with Azure OpenAI for text and image generation.
 */
export class OpenAiService {
	private client: AzureOpenAI;
	private modelName: string;
	private deployment: string;

	/**
	 * Initializes the OpenAI service with the specified model and deployment.
	 * @param {string} modelName - The name of the OpenAI model to use.
	 * @param {string} deployment - The deployment name for the model.
	 * @throws {Error} If required environment variables are missing.
	 */
	constructor(modelName: string, deployment: string) {
		const apiKey = process.env.AZURE_OPENAI_API_KEY_WEST || '';
		const endpoint = process.env.AZURE_OPENAI_ENDPOINT_WEST || '';
		const apiVersion = process.env.AZURE_OPENAI_API_VERSION_WEST || '';
		if (!apiKey || !endpoint || !apiVersion) {
			const missingVars = [
				!apiKey && 'AZURE_OPENAI_API_KEY_WEST',
				!endpoint && 'AZURE_OPENAI_ENDPOINT_WEST',
				!apiVersion && 'AZURE_OPENAI_API_VERSION_WEST',
			]
				.filter(Boolean)
				.join(', ');

			throw new Error(
				`Missing required environment variables for OpenAI configuration: ${missingVars}`
			);
		}
		const options = { endpoint, apiKey, deployment, apiVersion };
		this.client = new AzureOpenAI(options);
		this.modelName = modelName;
		this.deployment = deployment;
	}

	/**
	 * Calls the OpenAI API with the given messages and model.
	 * @param {object} params - The parameters for the API call.
	 * @param {{ role: 'system' | 'user'; content: string }[]} params.messages - The message array.
	 * @param {string} params.model - The model name.
	 * @returns {Promise<string>} The response content from OpenAI.
	 * @throws {Error} If the API call fails.
	 */
	private async callOpenAiApi({
		messages,
		model,
	}: {
		messages: { role: 'system' | 'user'; content: string }[];
		model: string;
	}): Promise<string> {
		try {
			const response = await this.client.chat.completions.create({
				messages: messages.map(msg => ({
					role: msg.role,
					content: msg.content,
				})),
				// gpt-5 models are reasoning models: reasoning tokens count against the
				// budget, so allow ample headroom and keep reasoning light for what is a
				// creative writing task (not a reasoning one).
				max_completion_tokens: 2000,
				reasoning_effort: 'low',
				model,
			});
			return response.choices[0]?.message?.content || '';
		} catch (error: any) {
			console.error('Error calling OpenAI API:', {
				error: error.message,
				stack: error.stack,
				model,
				messages,
			});
			throw new Error('Failed to call OpenAI API');
		}
	}

	/**
	 * Generates a response from OpenAI using a system prompt and user message.
	 * @param {object} params - The parameters for the response.
	 * @param {string} params.model - The model name.
	 * @param {string} params.prompt - The system prompt.
	 * @param {string} params.userMessage - The user message.
	 * @returns {Promise<string>} The generated response.
	 * @throws {Error} If generation fails.
	 */
	async generateResponse({
		model,
		prompt,
		userMessage,
	}: {
		model: string;
		prompt: string;
		userMessage: string;
	}): Promise<string> {
		try {
			const response = await this.callOpenAiApi({
				messages: [
					{ role: 'system', content: prompt },
					{ role: 'user', content: userMessage },
				],
				model,
			});
			return response;
		} catch (error: any) {
			console.error('Error generating response:', {
				error: error.message,
				stack: error.stack,
				model,
				prompt,
				userMessage,
			});
			throw new Error('Failed to generate response');
		}
	}

	/**
	 * Generates text from OpenAI using a system prompt.
	 * @param {object} params - The parameters for text generation.
	 * @param {string} params.model - The model name.
	 * @param {string} params.prompt - The system prompt.
	 * @returns {Promise<string>} The generated text.
	 * @throws {Error} If generation fails.
	 */
	async generateText({
		model,
		prompt,
	}: {
		model: string;
		prompt: string;
	}): Promise<string> {
		try {
			const response = await this.callOpenAiApi({
				messages: [{ role: 'system', content: prompt }],
				model,
			});
			return response;
		} catch (error) {
			console.error('Error generating text:', error);
			throw new Error('Failed to generate text');
		}
	}

	/**
	 * Generates a cover image with gpt-image-1 via Azure OpenAI and returns the
	 * raw PNG bytes. (The image API returns base64 data, not a URL.)
	 * @param {object} params - The parameters for image generation.
	 * @param {string} params.prompt - The image generation prompt.
	 * @param {'1024x1024' | '1536x1024' | '1024x1536'} [params.size] - Image size.
	 * @param {'low' | 'medium' | 'high'} [params.quality] - Image quality.
	 * @returns {Promise<Buffer>} The generated image bytes.
	 * @throws {Error} If image generation fails.
	 */
	async generateImage({
		prompt,
		size = '1024x1024',
		quality = 'high',
	}: {
		prompt: string;
		size?: '1024x1024' | '1536x1024' | '1024x1536';
		quality?: 'low' | 'medium' | 'high';
	}): Promise<Buffer> {
		try {
			const { deployment } = getModelDetails(OpenAIModels.IMAGE);

			// The image model can live on a different resource/region than text;
			// fall back to the text (West) resource if no dedicated image config.
			const imageEndpoint =
				process.env.AZURE_OPENAI_IMAGE_ENDPOINT ||
				process.env.AZURE_OPENAI_ENDPOINT_WEST;
			const imageApiVersion =
				process.env.AZURE_OPENAI_IMAGE_API_VERSION || '2025-04-01-preview';
			const imageApiKey =
				process.env.AZURE_OPENAI_IMAGE_API_KEY ||
				process.env.AZURE_OPENAI_API_KEY_WEST;

			if (!imageEndpoint || !imageApiKey) {
				const missing = [
					!imageEndpoint && 'AZURE_OPENAI_IMAGE_ENDPOINT (or _WEST)',
					!imageApiKey && 'AZURE_OPENAI_IMAGE_API_KEY (or _WEST)',
				]
					.filter(Boolean)
					.join(', ');
				throw new Error(
					`Missing required environment variables for image generation: ${missing}`
				);
			}

			const imageClient = new AzureOpenAI({
				endpoint: imageEndpoint,
				apiKey: imageApiKey,
				apiVersion: imageApiVersion,
				deployment,
			});

			console.log(
				`Generating image with ${deployment}: size=${size}, quality=${quality}, prompt=${prompt.length} chars`
			);

			const response = await imageClient.images.generate({
				model: deployment,
				prompt,
				n: 1,
				// gpt-image-1 accepts sizes/quality the SDK's type union lags behind.
				size: size as never,
				quality: quality as never,
			});

			const b64 = response.data?.[0]?.b64_json;
			if (!b64) {
				throw new Error('No image data returned from the image model');
			}
			return Buffer.from(b64, 'base64');
		} catch (error: any) {
			console.error('Error generating image:', {
				error: error.message,
				stack: error.stack,
				size,
				quality,
			});
			throw new Error(`Failed to generate image: ${error.message}`);
		}
	}
}
