import {
	BlobServiceClient,
	BlockBlobClient,
	ContainerClient,
} from '@azure/storage-blob';

/**
 * Service for managing blob storage operations in Azure Storage
 */
export class BlobStorageService {
	private blobServiceClient: BlobServiceClient;
	private containerClient: ContainerClient;
	private containerName: string;

	/**
	 * Initializes Azure Blob Storage client using environment variables
	 * @throws {Error} If AZURE_STORAGE_CONNECTION_STRING is missing
	 */
	constructor() {
		const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
		this.containerName =
			process.env.AZURE_STORAGE_CONTAINER_NAME || 'linkedin-images';

		if (!connectionString) {
			throw new Error(
				'Missing required environment variable: AZURE_STORAGE_CONNECTION_STRING'
			);
		}

		this.blobServiceClient =
			BlobServiceClient.fromConnectionString(connectionString);
		this.containerClient = this.blobServiceClient.getContainerClient(
			this.containerName
		);
	}

	/**
	 * Ensures the blob container exists, creates it if not present
	 * @returns {Promise<void>}
	 * @throws {Error} If container creation fails
	 */
	async initialize(): Promise<void> {
		try {
			const containerExists = await this.containerClient.exists();
			if (!containerExists) {
				console.log(`Creating container '${this.containerName}'...`);
				await this.containerClient.create({
					access: 'blob',
				});
				console.log(`Container '${this.containerName}' created successfully`);
			}
		} catch (error) {
			console.error('Error initializing blob container:', error);
			throw error;
		}
	}

	/**
	 * Uploads an image buffer to Azure Blob Storage
	 * @param {Buffer} imageBuffer - The image data as a Buffer
	 * @param {string} fileName - Name to give the file in blob storage
	 * @returns {Promise<string>} - URL of the uploaded blob
	 * @throws {Error} If upload fails
	 */
	async uploadImage(imageBuffer: Buffer, fileName: string): Promise<string> {
		try {
			await this.initialize();
			const uniqueFileName = `${Date.now()}-${fileName}`;
			const blockBlobClient =
				this.containerClient.getBlockBlobClient(uniqueFileName);
			console.log(`Uploading image to blob storage: ${uniqueFileName}`);
			await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
				blobHTTPHeaders: {
					blobContentType: this.getContentType(fileName),
				},
			});
			console.log(`Image uploaded successfully to: ${blockBlobClient.url}`);
			return blockBlobClient.url;
		} catch (error) {
			console.error('Error uploading image to blob storage:', error);
			throw new Error(
				`Failed to upload image to blob storage: ${error.message}`
			);
		}
	}

	/**
	 * Gets the content type based on file extension
	 * @param {string} fileName - The name of the file
	 * @returns {string} - The MIME type
	 */
	private getContentType(fileName: string): string {
		const extension = fileName.split('.').pop()?.toLowerCase();
		switch (extension) {
			case 'jpg':
			case 'jpeg':
				return 'image/jpeg';
			case 'png':
				return 'image/png';
			case 'gif':
				return 'image/gif';
			case 'webp':
				return 'image/webp';
			default:
				return 'application/octet-stream';
		}
	}
}
