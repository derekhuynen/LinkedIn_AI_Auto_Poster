# Copilot Instructions for LinkedIn AI Auto Poster

## Project Context

This project is an Azure-based automation for generating and posting LinkedIn content using Azure Functions, Azure OpenAI, Cosmos DB, and Key Vault. The main workflow is in `src/flow/linkedin_post_flow.ts` and the Azure Function trigger is in `src/functions/auto_post.ts`.

**Key Features:**

- AI-powered LinkedIn post generation using Azure OpenAI GPT models
- DALL-E 3 image generation for enhanced post engagement
- Parallel processing of content and image generation for optimal performance
- LinkedIn media upload and post creation with images
- Cosmos DB storage for posts, topics, and image metadata

## Coding Best Practices

- **Use Azure Services**: Always use Azure Functions for automation, Azure OpenAI for content generation, Cosmos DB for storage, and Key Vault for secrets.
- **Environment Variables**: Access all secrets and configuration via environment variables. Never hardcode secrets or connection strings.
- **Error Handling**: Implement robust error handling and retries with exponential backoff for all external service calls.
- **Logging**: Use comprehensive logging for monitoring and troubleshooting. Log errors and important workflow steps.
- **Security**: Never log sensitive data. Use Key Vault for managing secrets.
- **Type Safety**: Use TypeScript types, especially for data models (see `src/types/Post.ts`).
- **Modular Design**: Keep business logic in service and flow modules. Keep Azure Function triggers thin.
- **Testing**: Write unit tests for business logic. Use mocks for external services.
- **Parallel Processing**: Use Promise.all() for independent operations like content and image generation.
- **Graceful Degradation**: Image generation failures should not break the main workflow.

## Project Structure Reference

- `src/flow/linkedin_post_flow.ts`: Orchestrates the main workflow.
- `src/functions/auto_post.ts`: Timer-triggered Azure Function entry point.
- `src/service/`: Contains service modules for Cosmos DB, LinkedIn API, OpenAI, etc.
- `src/types/Post.ts`: Data model for LinkedIn posts.

## Technical Implementation Details

### Retry Logic

Use the `retryUtil.ts` utility for implementing retry patterns:

```typescript
import { withRetry } from '../service/retryUtil';

// Example usage:
const result = await withRetry(() => openAiService.generateContent(prompt), {
	maxRetries: 3,
	baseDelayMs: 1000,
	logger: context.log,
});
```

### OpenAI Response Validation

Always validate OpenAI responses with type guards:

```typescript
function isGenerateTopicPromptResponse(
	response: any
): response is GenerateTopicPromptResponse {
	return (
		response &&
		typeof response === 'object' &&
		Array.isArray(response.topics) &&
		response.topics.every((topic: any) => typeof topic === 'string')
	);
}
```

### Error Handling Pattern

```typescript
try {
	// Operation
} catch (error) {
	context.log.error(`Error in operation: ${error.message}`);
	throw new Error(`Failed to perform operation: ${error.message}`);
}
```

### Cosmos DB Operations

Implement database operations in the CosmosService:

```typescript
async function savePost(post: Post): Promise<void> {
	try {
		const { resource } = await this.container.items.create(post);
		return resource;
	} catch (error) {
		throw new Error(`Failed to save post: ${error.message}`);
	}
}
```

### LinkedIn API Integration

Use the LinkedinService for all LinkedIn operations:

```typescript
async function createPost(post: Post, imageUrns: string[]): Promise<void> {
	// LinkedIn API call with proper error handling
}
```

## Azure Best Practices

- Use async/await for all I/O operations.
- Use dependency injection for services where possible.
- Follow the [Azure Functions best practices](https://learn.microsoft.com/en-us/azure/azure-functions/functions-best-practices).
- Follow the [Azure OpenAI security guidance](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/overview-security).
- Use [Cosmos DB SDK best practices](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/sdk-best-practices).

## Do Not

- Do not commit secrets or credentials.
- Do not bypass environment variable usage for configuration.
- Do not use deprecated Azure SDKs or APIs.
- Do not skip error handling or retry logic for external service calls.
- Do not use synchronous operations for I/O bound tasks.
- Do not implement complex business logic in Azure Function trigger files.

## Workflow Implementation

The main LinkedIn posting workflow follows these steps:

1. Retrieve recent posts from Cosmos DB to avoid topic repetition
2. Generate a new topic using Azure OpenAI
3. Generate a LinkedIn post based on the topic
4. Generate an image prompt based on the post content
5. Generate an image using DALL-E 3
6. Upload the image to LinkedIn's media service
7. Create a LinkedIn post with the uploaded image
8. Save the post details to Cosmos DB

## Type Definitions

Always use proper type definitions for data structures:

```typescript
interface Post {
	id: string;
	content: string;
	topic: string;
	topicPrompt: string;
	contentPrompt: string;
	imagePrompt?: string;
	imageUrl?: string;
	linkedinPostUrl?: string;
	createdAt: string;
	status: 'draft' | 'published' | 'failed';
	errorMessage?: string;
}
```
