import { CosmosClient, Container } from '@azure/cosmos';
import { getRateLimitContainerId } from '../constants/constants';

/** Result of a cap check. */
export interface RateLimitResult {
	allowed: boolean;
	count: number;
	remaining: number;
}

/** A counter document (per-day global, or per-IP window). */
interface CounterDoc {
	id: string;
	count: number;
	/** Cosmos time-to-live in seconds; lets short-lived per-IP counters self-clean. */
	ttl?: number;
}

/**
 * Enforces a global daily cap using a single Cosmos counter document per day.
 * The document id is `dryrun-<YYYY-MM-DD>` and the container partition key is `/id`.
 * Increments use ETag optimistic concurrency so concurrent callers cannot overspend.
 */
export class RateLimitService {
	private container: Container;

	constructor() {
		const endpoint = process.env.COSMOS_ENDPOINT;
		const key = process.env.COSMOS_KEY;
		const databaseId = process.env.COSMOS_DATABASE_ID;

		if (!endpoint || !key || !databaseId) {
			const missing = [
				!endpoint && 'COSMOS_ENDPOINT',
				!key && 'COSMOS_KEY',
				!databaseId && 'COSMOS_DATABASE_ID',
			]
				.filter(Boolean)
				.join(', ');
			throw new Error(
				`Missing required environment variables for RateLimitService: ${missing}`
			);
		}

		const client = new CosmosClient({ endpoint, key });
		this.container = client
			.database(databaseId)
			.container(getRateLimitContainerId());
	}

	/**
	 * Atomically checks a counter against a cap and, if under, increments it.
	 * @param id - The counter document id (e.g. `dryrun-2026-05-30` or `ip-<hash>-<hour>`).
	 * @param cap - Maximum allowed increments for this counter.
	 * @param ttlSeconds - Optional Cosmos TTL so short-lived counters (per-IP windows) self-clean.
	 * @returns allowed=false (with remaining 0) if the cap is reached, else allowed=true with the new count.
	 */
	async checkAndIncrement(
		id: string,
		cap: number,
		ttlSeconds?: number
	): Promise<RateLimitResult> {
		for (let attempt = 0; attempt < 5; attempt++) {
			const { resource, etag } = await this.readOrCreate(id, ttlSeconds);
			const current = resource.count;

			if (current >= cap) {
				return { allowed: false, count: current, remaining: 0 };
			}

			// Never write without an ETag to guard against: an unconditioned
			// replace could let concurrent callers overspend the cap. A read of
			// an existing Cosmos item always returns one, so a missing ETag is
			// anomalous; re-read rather than risk an unguarded increment.
			if (!etag) {
				continue;
			}

			try {
				await this.container
					.item(id, id)
					.replace<CounterDoc>(
						{ id, count: current + 1, ...(resource.ttl ? { ttl: resource.ttl } : {}) },
						{ accessCondition: { type: 'IfMatch', condition: etag } }
					);
				const newCount = current + 1;
				return {
					allowed: true,
					count: newCount,
					remaining: Math.max(0, cap - newCount),
				};
			} catch (error: any) {
				if (error?.code === 412) {
					continue;
				}
				throw error;
			}
		}

		// Exhausted the retry budget under contention. Fail closed (deny) so the
		// cap can never be exceeded; the cost is a rare false 429 under heavy load.
		return { allowed: false, count: cap, remaining: 0 };
	}

	/** Reads the counter, creating a fresh `{ count: 0 }` doc if it does not exist yet. */
	private async readOrCreate(
		id: string,
		ttlSeconds?: number
	): Promise<{ resource: CounterDoc; etag: string }> {
		const { resource, etag } = await this.container
			.item(id, id)
			.read<CounterDoc>();

		if (resource) {
			return { resource, etag: etag || '' };
		}

		try {
			await this.container.items.create<CounterDoc>({
				id,
				count: 0,
				...(ttlSeconds ? { ttl: ttlSeconds } : {}),
			});
		} catch (error: any) {
			if (error?.code !== 409) {
				throw error;
			}
		}

		const reread = await this.container.item(id, id).read<CounterDoc>();
		return {
			resource: reread.resource || { id, count: 0 },
			etag: reread.etag || '',
		};
	}
}
