import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	read: vi.fn(),
	create: vi.fn(),
	replace: vi.fn(),
	item: vi.fn(),
	container: vi.fn(),
}));

vi.mock('@azure/cosmos', () => {
	const itemApi = { read: mocks.read, replace: mocks.replace };
	mocks.item.mockReturnValue(itemApi);
	const containerApi = {
		item: mocks.item,
		items: { create: mocks.create },
	};
	return {
		CosmosClient: class {
			database() {
				return { container: () => containerApi };
			}
		},
	};
});

import { RateLimitService } from '../src/service/RateLimitService';

function setEnv() {
	process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';
	process.env.COSMOS_KEY = 'key';
	process.env.COSMOS_DATABASE_ID = 'AutoPoster';
	process.env.COSMOS_RATELIMIT_CONTAINER = 'RateLimits';
}

describe('RateLimitService.checkAndIncrement', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setEnv();
		const itemApi = { read: mocks.read, replace: mocks.replace };
		mocks.item.mockReturnValue(itemApi);
	});

	it('creates the counter on first use of the day and allows the run', async () => {
		mocks.read
			.mockResolvedValueOnce({ resource: undefined })
			.mockResolvedValueOnce({
				resource: { id: 'dryrun-2026-05-29', count: 0 },
				etag: 'etag-0',
			});
		mocks.create.mockResolvedValue({});
		mocks.replace.mockResolvedValue({ resource: { count: 1 } });

		const service = new RateLimitService();
		const result = await service.checkAndIncrement('2026-05-29', 50);

		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(49);
		expect(mocks.create).toHaveBeenCalledTimes(1);
		expect(mocks.replace).toHaveBeenCalledTimes(1);
	});

	it('allows and increments when under the cap', async () => {
		mocks.read.mockResolvedValue({
			resource: { id: 'dryrun-2026-05-29', count: 10 },
			etag: 'etag-10',
		});
		mocks.replace.mockResolvedValue({ resource: { count: 11 } });

		const service = new RateLimitService();
		const result = await service.checkAndIncrement('2026-05-29', 50);

		expect(result.allowed).toBe(true);
		expect(result.count).toBe(11);
		expect(result.remaining).toBe(39);
		expect(mocks.replace).toHaveBeenCalledTimes(1);
	});

	it('blocks and does not increment when the cap is reached', async () => {
		mocks.read.mockResolvedValue({
			resource: { id: 'dryrun-2026-05-29', count: 50 },
			etag: 'etag-50',
		});

		const service = new RateLimitService();
		const result = await service.checkAndIncrement('2026-05-29', 50);

		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
		expect(mocks.replace).not.toHaveBeenCalled();
	});
});
