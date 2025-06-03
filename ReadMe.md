# LinkedIn AI Auto Poster

## Overview

The LinkedIn AI Auto Poster is an intelligent, AI-driven solution designed to automate the creation and publishing of engaging LinkedIn content. Leveraging cutting-edge Azure OpenAI technology, this application streamlines content generation and ensures consistent, high-quality posting directly to LinkedIn. Ideal for professionals looking to enhance their digital presence effortlessly, this automated system saves significant time while maintaining active audience engagement.

## Features

- **AI-Enhanced Daily Automation**: Automatically executes daily at 9 AM, handling content creation and posting seamlessly.
- **Dynamic AI Topic Generation**: Utilizes Azure OpenAI to craft unique and relevant topics, intelligently avoiding repetition.
- **Automated Content Creation**: Produces captivating LinkedIn posts with advanced AI-generated insights.
- **DALL-E 3 Image Generation**: Creates professional, engaging images for each post to boost engagement and visibility.
- **Parallel Processing**: Generates content and images simultaneously for optimal performance.
- **Direct LinkedIn Integration**: Publishes AI-crafted content with images directly to your LinkedIn profile or page.
- **Efficient Data Storage**: Archives generated posts, images, and metadata in Azure Cosmos DB for future reference, analysis, and repurposing.

## AI-Powered Architecture

The solution employs a robust combination of Azure services:

- **Azure Functions**: Scheduled timer-triggered functions manage daily automation.
- **Azure OpenAI**: Provides state-of-the-art generative AI capabilities for topic and content creation.
- **Azure Cosmos DB**: Securely stores generated posts, ensuring data persistence and easy retrieval.
- **Secure Environment Management**: Uses environment variables and Azure Key Vault to safely manage API keys and connection strings.

## Intelligent Workflow

1. **Content Analysis**: Retrieves recent posts from Azure Cosmos DB to ensure fresh topic selection.
2. **AI-Driven Topic Generation**: Generates distinctive topics using a specialized AI prompt.
3. **Parallel Content & Image Creation**: Simultaneously crafts high-quality LinkedIn posts and generates professional images using DALL-E 3.
4. **Image Processing**: Downloads generated images and uploads them to LinkedIn's media service.
5. **Automated Posting**: Seamlessly publishes the AI-generated content with images directly onto LinkedIn.
6. **Archiving & Analysis**: Saves each post, image metadata, and generation prompts into Azure Cosmos DB, supporting future insights and analytics.

## Environment Configuration

Essential environment variables include:

- `AzureWebJobsStorage`, `FUNCTIONS_WORKER_RUNTIME`
- `OPENAI_API_KEY`, `OPENAI_ENDPOINT`, `OPENAI_API_VERSION`
- `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_MEMBER_URN`
- `COSMOS_KEY`, `COSMOS_ENDPOINT`, `COSMOS_DATABASE_ID`, `COSMOS_LINKEDIN_CONTAINER`
- `ENABLE_LINKEDIN_POST`, `ENABLE_IMAGE_GENERATION`

## Project Structure

```
linkedin_ai_auto_poster/
├── host.json
├── local.settings.json
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── constants/
│   ├── flow/
│   │   └── linkedin_post_flow.ts
│   ├── functions/
│   │   ├── auto_post.ts
│   │   ├── test_linkedin_post.ts
│   │   └── test_image_generation.ts
│   ├── prompts/
│   │   ├── generate_linkedin_post_derek_huynen.md
│   │   ├── generate_topic_derek_huynen.md
│   │   └── generate_linkedin_image_prompt.md
│   ├── service/
│   │   ├── CosmosService.ts
│   │   ├── LinkedinService.ts
│   │   ├── MdService.ts
│   │   └── OpenAiService.ts
│   └── types/
│       └── Post.ts
├── scripts/
│   ├── deploy-infra.sh
│   └── publishProfile.publishsettings
├── ReadMe.md
```

### Key Components

- **`linkedin_post_flow.ts`**: Coordinates the intelligent AI-driven workflow.
- **`auto_post.ts`**: Azure Function scheduled trigger implementation.
- **`CosmosService.ts`**: Manages database interactions.
- **`LinkedinService.ts`**: Handles LinkedIn API interactions.
- **`OpenAiService.ts`**: Facilitates content and topic generation using Azure OpenAI.

## Getting Started

### Quick Setup

1. **Clone & Navigate**:

   ```bash
   git clone <repository-url>
   cd linkedin_ai_auto_poster
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Configure Variables**:
   Set your environment variables in `local.settings.json`.

4. **Local Execution**:
   Run locally with Azure Functions Core Tools:

   ```bash
   func start
   ```

5. **Test Image Generation**:
   Test the DALL-E 3 image generation feature:

   ```bash
   .\scripts\test_dalle3.ps1
   ```

6. **Deploy to Azure**:
   ```bash
   func azure functionapp publish <function-app-name>
   ```

## Documentation

- **Main Guide**: [ReadMe.md](ReadMe.md) - Overview and main documentation
- **Environment Variables**: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Configuration settings
- **Image Generation Guide**: [IMAGE_GENERATION_GUIDE.md](IMAGE_GENERATION_GUIDE.md) - Using the image generation feature
- **DALL-E 3 Testing**: [DALLE3_TESTING.md](DALLE3_TESTING.md) - Testing the DALL-E 3 integration
- **Customizing Images**: [CUSTOMIZE_DALLE3_IMAGES.md](CUSTOMIZE_DALLE3_IMAGES.md) - Tailoring image generation
- **Sample Prompts**: [SAMPLE_IMAGE_PROMPTS.md](SAMPLE_IMAGE_PROMPTS.md) - Example prompts for reference

## Azure AI Setup

### 1. Azure AI Foundry & Hub

- Create resources via Azure Portal to host and manage your AI models.

### 2. Model Deployment

- Deploy your chosen OpenAI model and note endpoint and API details.

## LinkedIn API Integration

1. **LinkedIn Developer Project**:

   - Visit [LinkedIn Developers](https://www.linkedin.com/developers) to create and configure your app.

2. **Generate OAuth Token**:

   - Obtain access tokens via LinkedIn’s OAuth tools.

3. **Retrieve LinkedIn URN**:

   - Use the LinkedIn API:
     ```http
     GET https://api.linkedin.com/v2/userinfo
     ```
     - Pass the `Authorization: Bearer <access_token>` header to get your member URN.

4. **Secure Credentials**:
   - Save tokens securely in your environment variables.

## Cosmos DB Configuration

1. **Create Cosmos DB Instance**:

   - Set up Cosmos DB on Azure Portal and define the data model (`src/types/Post.ts`).

2. **Configure Credentials**:
   - Store DB credentials in environment variables.

## Best Practices

- **Security**: Utilize Azure Key Vault for managing sensitive credentials.
- **Robust Error Handling**: Implement retries with exponential backoff.
- **Optimized Performance**: Enhance query performance and use caching where feasible.
- **Comprehensive Logging**: Enable detailed logs for monitoring and troubleshooting.

## Future Roadmap

- Multi-platform social media support
- Web dashboard for managing content
- Advanced analytics integration for detailed performance tracking

## Additional Resources

- [Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/)
- [Azure Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/)
