import { describe, it, expect, beforeEach } from 'vitest';
import { BlobStorageService } from '../src/service/BlobStorageService';

describe('BlobStorageService.getContentType', () => {
	let service: BlobStorageService;

	beforeEach(() => {
		process.env.AZURE_STORAGE_CONNECTION_STRING =
			'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net';
		service = new BlobStorageService();
	});

	it('maps known extensions to MIME types', () => {
		expect(service.getContentType('a.jpg')).toBe('image/jpeg');
		expect(service.getContentType('a.jpeg')).toBe('image/jpeg');
		expect(service.getContentType('a.png')).toBe('image/png');
		expect(service.getContentType('a.gif')).toBe('image/gif');
		expect(service.getContentType('a.webp')).toBe('image/webp');
	});

	it('falls back to octet-stream for unknown or missing extensions', () => {
		expect(service.getContentType('a.bmp')).toBe('application/octet-stream');
		expect(service.getContentType('noextension')).toBe(
			'application/octet-stream'
		);
	});
});
