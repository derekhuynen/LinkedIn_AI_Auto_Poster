import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/service/retryUtil';

const noopContext = { log: () => {} };

describe('withRetry', () => {
	it('returns the result when the function succeeds on the first try', async () => {
		const fn = vi.fn().mockResolvedValue('ok');
		const result = await withRetry(fn, 3, noopContext, 'op');
		expect(result).toBe('ok');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries then succeeds', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('transient'))
			.mockResolvedValueOnce('ok');
		const result = await withRetry(fn, 3, noopContext, 'op');
		expect(result).toBe('ok');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('throws the last error after exhausting retries', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('always fails'));
		await expect(withRetry(fn, 2, noopContext, 'op')).rejects.toThrow(
			'always fails'
		);
		expect(fn).toHaveBeenCalledTimes(3);
	});
});
