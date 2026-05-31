import { describe, it, expect } from 'vitest';
import { isGenerateTopicPromptResponse } from '../src/flow/linkedin_post_flow';

describe('isGenerateTopicPromptResponse', () => {
	const valid = {
		topic: 'AI in healthcare',
		topic_description: 'How AI assists diagnosis',
		research: 'Some background',
	};

	it('accepts a fully valid object', () => {
		expect(isGenerateTopicPromptResponse(valid)).toBe(true);
	});

	it('rejects null and non-objects', () => {
		expect(isGenerateTopicPromptResponse(null)).toBe(false);
		expect(isGenerateTopicPromptResponse('string')).toBe(false);
		expect(isGenerateTopicPromptResponse(42)).toBe(false);
	});

	it('rejects when a required field is missing', () => {
		const { research, ...missingResearch } = valid;
		expect(isGenerateTopicPromptResponse(missingResearch)).toBe(false);
	});

	it('rejects when a field has the wrong type', () => {
		expect(
			isGenerateTopicPromptResponse({ ...valid, topic: 123 })
		).toBe(false);
	});
});
