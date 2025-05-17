export enum OpenAIModels {
	GPT_4_1 = 'GPT_4_1',
}

export function getModelDetails(model: OpenAIModels): {
	modelName: string;
	deployment: string;
} {
	switch (model) {
		case OpenAIModels.GPT_4_1:
			return { modelName: 'gpt-4.1', deployment: 'gpt-4.1' };
		default:
			throw new Error('Unsupported model');
	}
}
