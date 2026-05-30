import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock functions shared across the mocked service classes.
const mocks = vi.hoisted(() => ({
	generateResponse: vi.fn(),
	generateImage: vi.fn(),
	downloadImageAsBuffer: vi.fn(),
	postToLinkedIn: vi.fn(),
	uploadImageToLinkedIn: vi.fn(),
	uploadImage: vi.fn(),
	createItem: vi.fn(),
	queryItems: vi.fn(),
}));

vi.mock('../src/service/OpenAiService', () => ({
	OpenAiService: vi.fn(() => ({
		generateResponse: mocks.generateResponse,
		generateImage: mocks.generateImage,
		downloadImageAsBuffer: mocks.downloadImageAsBuffer,
	})),
}));

vi.mock('../src/service/LinkedinService', () => ({
	default: vi.fn(() => ({
		postToLinkedIn: mocks.postToLinkedIn,
		uploadImageToLinkedIn: mocks.uploadImageToLinkedIn,
	})),
}));

vi.mock('../src/service/CosmosService', () => ({
	CosmosService: vi.fn(() => ({
		queryItems: mocks.queryItems,
		createItem: mocks.createItem,
	})),
}));

vi.mock('../src/service/BlobStorageService', () => ({
	BlobStorageService: vi.fn(() => ({
		uploadImage: mocks.uploadImage,
	})),
}));

import { linkedInPostFlow } from '../src/flow/linkedin_post_flow';
import type { InvocationContext } from '@azure/functions';

const context = { log: vi.fn() } as unknown as InvocationContext;

function primeHappyPath() {
	mocks.queryItems.mockResolvedValue([]);
	mocks.generateResponse
		.mockResolvedValueOnce(
			JSON.stringify({
				topic: 'AI in healthcare',
				topic_description: 'How AI assists diagnosis',
				research: 'background',
			})
		)
		.mockResolvedValue('generated text');
	mocks.generateImage.mockResolvedValue('https://dalle/image.png');
	mocks.downloadImageAsBuffer.mockResolvedValue(Buffer.from('img'));
	mocks.uploadImage.mockResolvedValue('https://blob/image.jpg');
	mocks.uploadImageToLinkedIn.mockResolvedValue('urn:li:digitalmediaAsset:123');
	mocks.postToLinkedIn.mockResolvedValue(undefined);
	mocks.createItem.mockResolvedValue({});
}

describe('linkedInPostFlow', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.COSMOS_LINKEDIN_CONTAINER = 'LinkedInPosts';
		primeHappyPath();
	});

	it('dry-run never posts to LinkedIn and never persists', async () => {
		await linkedInPostFlow(context, {
			triggerBy: 'preview',
			post: false,
			persist: false,
			generateImage: true,
		});

		expect(mocks.postToLinkedIn).not.toHaveBeenCalled();
		expect(mocks.uploadImageToLinkedIn).not.toHaveBeenCalled();
		expect(mocks.createItem).not.toHaveBeenCalled();
	});

	it('full run posts to LinkedIn and persists to Cosmos', async () => {
		await linkedInPostFlow(context, {
			triggerBy: 'timer',
			post: true,
			persist: true,
			generateImage: true,
		});

		expect(mocks.postToLinkedIn).toHaveBeenCalledTimes(1);
		expect(mocks.createItem).toHaveBeenCalledTimes(1);
	});

	it('skips image generation when generateImage is false', async () => {
		await linkedInPostFlow(context, {
			triggerBy: 'preview',
			post: false,
			persist: false,
			generateImage: false,
		});

		expect(mocks.generateImage).not.toHaveBeenCalled();
		expect(mocks.uploadImageToLinkedIn).not.toHaveBeenCalled();
	});
});
