import { CosmosClient, Container } from '@azure/cosmos';

/**
 * Options for CosmosService
 */
interface CosmosServiceOptions {
	containerId: string;
}

/**
 * Service for managing Cosmos DB operations
 * @template T - The type of items stored in the container
 */
export class CosmosService<T> {
	private client: CosmosClient;
	private container: Container;

	/**
	 * Initializes Cosmos DB client and container
	 * @param {CosmosServiceOptions} options - Options including containerId
	 * @throws {Error} If required environment variables are missing
	 */
	constructor(private options: CosmosServiceOptions) {
		const endpoint = process.env.COSMOS_ENDPOINT;
		const key = process.env.COSMOS_KEY;
		const databaseId = process.env.COSMOS_DATABASE_ID;

		if (!endpoint || !key || !databaseId) {
			const missingVars = [
				!endpoint && 'COSMOS_ENDPOINT',
				!key && 'COSMOS_KEY',
				!databaseId && 'COSMOS_DATABASE_ID',
			]
				.filter(Boolean)
				.join(', ');

			throw new Error(
				`Missing required environment variables for Cosmos DB configuration: ${missingVars}`
			);
		}

		this.client = new CosmosClient({ endpoint, key });
		this.container = this.client
			.database(databaseId)
			.container(options.containerId);
	}

	/**
	 * Creates a new item in the Cosmos DB container
	 * @param {T} item - The item to create
	 * @returns {Promise<T>} The created item
	 * @throws {Error} If creation fails
	 */
	async createItem(item: T): Promise<T> {
		try {
			const { resource } = await this.container.items.create(item);
			return resource;
		} catch (error) {
			console.error('Error creating item:', error);
			throw error;
		}
	}

	/**
	 * Reads an item from the Cosmos DB container
	 * @param {string} id - The id of the item
	 * @param {string} partitionKey - The partition key
	 * @returns {Promise<T>} The read item
	 * @throws {Error} If read fails
	 */
	async readItem(id: string, partitionKey: string): Promise<T> {
		try {
			const { resource } = await this.container
				.item(id, partitionKey)
				.read<T>();
			return resource;
		} catch (error) {
			console.error('Error reading item:', error);
			throw error;
		}
	}

	/**
	 * Queries items in the Cosmos DB container
	 * @param {string} query - The SQL query string
	 * @param {object} [options] - Optional query options (limit, continuationToken)
	 * @returns {Promise<T[]>} The queried items
	 * @throws {Error} If query fails
	 */
	async queryItems(
		query: string,
		options?: { limit?: number; continuationToken?: string }
	): Promise<T[]> {
		try {
			const queryOptions: any = {};

			if (options?.limit) {
				queryOptions.maxItemCount = options.limit;
			}

			if (options?.continuationToken) {
				queryOptions.continuationToken = options.continuationToken;
			}

			const { resources } = await this.container.items
				.query<T>(query, queryOptions)
				.fetchAll();
			return resources;
		} catch (error) {
			console.error('Error querying items:', {
				error: error.message,
				stack: error.stack,
				query: query,
			});
			throw error;
		}
	}

	/**
	 * Queries items with pagination support
	 * @param {string} query - The SQL query string
	 * @param {object} [options] - Pagination options (limit, continuationToken)
	 * @returns {Promise<{ items: T[]; continuationToken?: string }>} Items and continuation token
	 * @throws {Error} If query fails
	 */
	async queryItemsWithPagination(
		query: string,
		options?: { limit?: number; continuationToken?: string }
	): Promise<{ items: T[]; continuationToken?: string }> {
		try {
			const queryOptions: any = {};

			if (options?.limit) {
				queryOptions.maxItemCount = options.limit;
			}

			if (options?.continuationToken) {
				queryOptions.continuationToken = options.continuationToken;
			}

			const iterator = this.container.items.query<T>(query, queryOptions);
			const response = await iterator.fetchNext();

			return {
				items: response.resources,
				continuationToken: response.continuationToken,
			};
		} catch (error) {
			console.error('Error querying items with pagination:', {
				error: error.message,
				stack: error.stack,
				query: query,
			});
			throw error;
		}
	}

	/**
	 * Sets the container to use for subsequent operations
	 * @param {string} containerId - The new container ID
	 * @throws {Error} If containerId is not provided
	 */
	setContainer(containerId: string): void {
		if (!containerId) {
			throw new Error('Container ID must be provided to setContainer method.');
		}

		this.container = this.client
			.database(process.env.COSMOS_DATABASE_ID)
			.container(containerId);
	}
}
