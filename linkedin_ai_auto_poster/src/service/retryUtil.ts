// Utility: Retry logic with exponential backoff for transient errors
// Usage: await withRetry(() => someAsyncFunction(), 3, context, 'operationName');

/**
 * Executes an async function with retry logic and exponential backoff for transient errors.
 * @template T
 * @param {() => Promise<T>} fn - The async function to execute.
 * @param {number} [retries=3] - Number of retry attempts.
 * @param {{ log: (...args: any[]) => void }} [context] - Optional context for logging.
 * @param {string} [operationName='operation'] - Name of the operation for logging.
 * @returns {Promise<T>} The result of the async function if successful.
 * @throws {any} The last error if all retries fail.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	retries = 3,
	context?: { log: (...args: any[]) => void },
	operationName = 'operation'
): Promise<T> {
	let attempt = 0;
	let lastError: any;
	while (attempt <= retries) {
		try {
			return await fn();
		} catch (err: any) {
			lastError = err;
			attempt++;
			if (context && context.log) {
				context.log(
					`[${operationName}] Attempt ${attempt} failed: ${err.message}`
				);
			}
			if (attempt > retries) break;
			// Exponential backoff with jitter
			const delay =
				Math.pow(2, attempt) * 100 + Math.floor(Math.random() * 100);
			await new Promise(res => setTimeout(res, delay));
		}
	}
	if (context && context.log) {
		context.log(
			`[${operationName}] All ${
				retries + 1
			} attempts failed. Throwing last error.`
		);
	}
	throw lastError;
}
