/**
 * Represents a LinkedIn post and its associated metadata.
 * @typedef {Object} Post
 * @property {string} [id] - Unique identifier for the post (Cosmos DB).
 * @property {string} topic - The main topic of the post.
 * @property {string} [topicDescription] - Description of the topic.
 * @property {string} [research] - Research or background information for the post.
 * @property {string} content - The main content of the post (legacy, use linkedInPost).
 * @property {string} [linkedInPost] - The generated LinkedIn post content.
 * @property {string} createdAt - ISO timestamp when the post was created.
 * @property {string} [triggerBy] - What triggered the post (e.g., timer, http).
 * @property {string} [imageUrl] - Temporary URL from DALL-E for the generated image.
 * @property {string} [blobStorageUrl] - Permanent URL in Azure Blob Storage for the image.
 * @property {string} [imageAsset] - LinkedIn media asset ID for the uploaded image.
 * @property {string} [imagePrompt] - The prompt used to generate the image.
 */
export type Post = {
	id?: string;
	topic: string;
	topicDescription?: string;
	research?: string;
	content: string;
	linkedInPost?: string;
	createdAt: string;
	triggerBy?: string;
	imageUrl?: string;
	blobStorageUrl?: string;
	imageAsset?: string;
	imagePrompt?: string;
};
