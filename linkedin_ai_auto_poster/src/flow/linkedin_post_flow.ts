import { InvocationContext } from '@azure/functions';
import { OpenAiService } from '../service/OpenAiService';
import { getModelDetails, OpenAIModels } from '../constants/constants';
import { MdService } from '../service/MdService';
import LinkedinService from '../service/LinkedinService';
import { CosmosService } from '../service/CosmosService';
import { Post } from '../types/Post';

const generateTopicPrompt = MdService.readMarkdownFile(
	'../prompts/generate_topic_derek_huynen.md'
);

const generateLinkedInPostPrompt = MdService.readMarkdownFile(
	'../prompts/generate_linkedin_post_derek_huynen.md'
);

export async function linkedInPostFlow(context: InvocationContext): Promise<{
	topic: string;
	linkedInPost: string;
	createdAt: string;
}> {
	const containerId = process.env.COSMOS_LINKEDIN_CONTAINER || '';

	// Improved error handling and logging
	if (!containerId) {
		const errorMessage =
			'COSMOS_LINKEDIN_CONTAINER environment variable is not set';
		context.log(errorMessage);
		throw new Error(errorMessage);
	}

	const { modelName, deployment } = getModelDetails(OpenAIModels.GPT_4_1);
	const openAiService = new OpenAiService(modelName, deployment);
	const linkedinService = new LinkedinService();
	const cosmosService = new CosmosService({
		containerId: containerId,
	});

	// Assign createdAt to a variable to avoid redundancy
	const createdAt = new Date().toISOString();

	try {
		// Step 0: Grab last 1-3 posts and ensure no topic repetition
		const lastPostsQuery = `SELECT TOP 3 * FROM c WHERE c.topic != null ORDER BY c.createdAt DESC`;
		const lastPosts = (await cosmosService.queryItems(
			lastPostsQuery
		)) as Post[];

		// Step 1: Generate a topic
		const topic = await openAiService.generateResponse({
			model: modelName,
			prompt: generateTopicPrompt,
			userMessage: `Make sure to not repeat any of the last 3 topics: ${lastPosts
				.map(post => post.topic)
				.join(', ')}`,
		});

		// Step 2: Generate a LinkedIn post using the topic
		const linkedInPost = await openAiService.generateResponse({
			model: modelName,
			prompt: generateLinkedInPostPrompt,
			userMessage: `Generate a LinkedIn post based on the topic: ${topic}`,
		});

		// Step 3: Post to LinkedIn (toggle with a flag for local testing)
		if (process.env.ENABLE_LINKEDIN_POST === 'true') {
			await linkedinService.postToLinkedIn(linkedInPost);
		} else {
			context.log('LinkedIn posting is disabled. Skipping Step 3.');
		}

		// Step 4: Save the LinkedIn post to Cosmos DB
		await cosmosService.createItem({
			topic: topic,
			content: linkedInPost,
			createdAt: createdAt,
		});

		return {
			topic: topic,
			linkedInPost: linkedInPost,
			createdAt: createdAt,
		};
	} catch (error: any) {
		context.log('Error generating or posting LinkedIn post', error);
		throw new Error(
			`Failed to generate or post LinkedIn post: ${error.message}`
		);
	}
}
