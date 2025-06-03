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
				max_completion_tokens: 800,
				temperature: 1,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
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
	 * Generates an image using DALL-E 3 via Azure OpenAI.
	 * @param {object} params - The parameters for image generation.
	 * @param {string} params.prompt - The image generation prompt.
	 * @param {'1024x1024' | '1792x1024' | '1024x1792'} [params.size] - Image size.
	 * @param {'standard' | 'hd'} [params.quality] - Image quality.
	 * @param {'vivid' | 'natural'} [params.style] - Image style.
	 * @returns {Promise<string>} The URL of the generated image.
	 * @throws {Error} If image generation fails.
	 */
	async generateImage({
		prompt,
		size = '1024x1024',
		quality = 'standard',
		style = 'vivid',
	}: {
		prompt: string;
		size?: '1024x1024' | '1792x1024' | '1024x1792';
		quality?: 'standard' | 'hd';
		style?: 'vivid' | 'natural';
	}): Promise<string> {
		try {
			// Get DALL-E 3 model details from constants
			const dalleDetails = getModelDetails(OpenAIModels.DALLE_3);

			// Use East region configuration for DALL-E 3
			const eastEndpoint =
				process.env.AZURE_OPENAI_ENDPOINT_EAST ||
				'https://djh-prod-ai-service-us-east.openai.azure.com/';
			const eastApiVersion =
				process.env.AZURE_OPENAI_API_VERSION_EAST || '2024-02-01';
			const dalleDeployment =
				process.env.AZURE_OPENAI_DALLE_DEPLOYMENT || 'dall-e-3';
			const eastApiKey =
				process.env.AZURE_OPENAI_API_KEY_EAST ||
				process.env.AZURE_OPENAI_API_KEY_WEST ||
				'';

			// Create a new client instance with East region's DALL-E 3 configuration
			const dalleClient = new AzureOpenAI({
				endpoint: eastEndpoint,
				apiKey: eastApiKey,
				apiVersion: eastApiVersion,
				deployment: dalleDeployment,
			});

			console.log('==== DALL-E 3 Configuration (East Region) ====');
			console.log(`- Model Name: ${dalleDetails.modelName}`);
			console.log(`- Deployment: ${dalleDeployment}`);
			console.log(`- Endpoint: ${eastEndpoint}`);
			console.log(`- API Version: ${eastApiVersion}`);
			console.log(
				`- Using East Region API Key: ${!!process.env
					.AZURE_OPENAI_API_KEY_EAST}`
			);
			console.log('===============================');
			console.log(
				`- Using dedicated DALL-E API Key: ${!!process.env.DALLE_API_KEY}`
			);
			console.log('===============================');

			console.log(
				`Generating image with DALL-E 3 (${dalleDetails.modelName}):`
			);
			console.log(`- Size: ${size}`);
			console.log(`- Quality: ${quality}`);
			console.log(`- Style: ${style}`);
			console.log(`- Prompt length: ${prompt.length} characters`);

			const response = await dalleClient.images.generate({
				model: dalleDetails.modelName,
				prompt: prompt,
				n: 1,
				size: size,
				quality: quality,
				style: style,
			});
			const imageUrl = response.data[0]?.url;
			if (!imageUrl) {
				throw new Error('No image URL returned from DALL-E 3');
			}

			console.log(
				'Image generated successfully:',
				imageUrl.substring(0, 60) + '...'
			);
			return imageUrl;
		} catch (error: any) {
			console.error('Error generating image with DALL-E 3:', {
				error: error.message,
				stack: error.stack,
				prompt,
				size,
				quality,
				style,
			});
			throw new Error(`Failed to generate image: ${error.message}`);
		}
	}

	/**
	 * Downloads an image from a URL and returns it as a buffer.
	 * @param {string} imageUrl - The URL of the image to download.
	 * @returns {Promise<Buffer>} The image data as a buffer.
	 * @throws {Error} If download fails.
	 */
	async downloadImageAsBuffer(imageUrl: string): Promise<Buffer> {
		try {
			const response = await fetch(imageUrl);
			if (!response.ok) {
				throw new Error(
					`Failed to download image: ${response.status} ${response.statusText}`
				);
			}

			const arrayBuffer = await response.arrayBuffer();
			return Buffer.from(arrayBuffer);
		} catch (error: any) {
			console.error('Error downloading image:', {
				error: error.message,
				imageUrl,
			});
			throw new Error(`Failed to download image: ${error.message}`);
		}
	}
}
