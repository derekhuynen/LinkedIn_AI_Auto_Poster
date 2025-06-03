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

---
