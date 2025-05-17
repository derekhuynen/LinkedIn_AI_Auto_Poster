import { CosmosClient, Container } from '@azure/cosmos';

interface CosmosServiceOptions {
	containerId: string;
}

export class CosmosService<T> {
	private client: CosmosClient;
	private container: Container;

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

	async createItem(item: T): Promise<T> {
		try {
			const { resource } = await this.container.items.create(item);
			return resource;
		} catch (error) {
			console.error('Error creating item:', error);
			throw error;
		}
	}

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

	async queryItems(query: string): Promise<T[]> {
		try {
			const { resources } = await this.container.items
				.query<T>(query)
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

	setContainer(containerId: string): void {
		if (!containerId) {
			throw new Error('Container ID must be provided to setContainer method.');
		}

		this.container = this.client
			.database(process.env.COSMOS_DATABASE_ID)
			.container(containerId);
	}
}
