import { AzureOpenAI } from 'openai';

export class OpenAiService {
	private client: AzureOpenAI;
	private modelName: string;
	private deployment: string;

	constructor(modelName: string, deployment: string) {
		const apiKey = process.env.OPENAI_API_KEY || '';
		const endpoint = process.env.OPENAI_ENDPOINT || '';
		const apiVersion = process.env.OPENAI_API_VERSION || '';
		if (!apiKey || !endpoint || !apiVersion) {
			const missingVars = [
				!apiKey && 'OPENAI_API_KEY',
				!endpoint && 'OPENAI_ENDPOINT',
				!apiVersion && 'OPENAI_API_VERSION',
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

	// Adjusted message structure to match expected type
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
}
