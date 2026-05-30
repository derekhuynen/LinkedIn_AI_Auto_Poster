import { CosmosClient, Container } from '@azure/cosmos';
import { getRateLimitContainerId } from '../constants/constants';

/** Result of a cap check. */
export interface RateLimitResult {
	allowed: boolean;
	count: number;
	remaining: number;
}

/** One counter document per UTC day. */
interface CounterDoc {
	id: string;
	count: number;
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
	 * Atomically checks the day's counter against the cap and, if under, increments it.
	 * @param day - UTC date string `YYYY-MM-DD`.
	 * @param cap - Maximum allowed increments for the day.
	 * @returns allowed=false (with remaining 0) if the cap is reached, else allowed=true with the new count.
	 */
	async checkAndIncrement(day: string, cap: number): Promise<RateLimitResult> {
		const id = `dryrun-${day}`;

		for (let attempt = 0; attempt < 5; attempt++) {
			const { resource, etag } = await this.readOrCreate(id);
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
						{ id, count: current + 1 },
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

	/** Reads the counter, creating a fresh `{ count: 0 }` doc if today's does not exist yet. */
	private async readOrCreate(
		id: string
	): Promise<{ resource: CounterDoc; etag: string }> {
		const { resource, etag } = await this.container
			.item(id, id)
			.read<CounterDoc>();

		if (resource) {
			return { resource, etag: etag || '' };
		}

		try {
			await this.container.items.create<CounterDoc>({ id, count: 0 });
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
