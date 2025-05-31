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

type GenerateTopicPromptResponse = {
	topic: string;
	topic_description: string;
	research: string;
};

export async function linkedInPostFlow(context: InvocationContext): Promise<{
	topic: string;
	topicDescription: string;
	research: string;
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
		const lastPostsQuery = `SELECT TOP 5 * FROM c WHERE c.topic != null ORDER BY c.createdAt DESC`;
		const lastPosts = (await cosmosService.queryItems(
			lastPostsQuery
		)) as Post[];

		// Step 1: Generate a topic: should return type GenerateTopicPromptResponse
		const topicResponse = await openAiService.generateResponse({
			model: modelName,
			prompt: generateTopicPrompt,
			userMessage: `## PAST TOPICS ## \n Please avoid repeating topics from the last posts: \n
			${lastPosts.map(post => post.topic).join(', ')}`,
		});

		//convert the json response to a GenerateTopicPromptResponse type
		const topicData: GenerateTopicPromptResponse = JSON.parse(topicResponse);

		// Step 2: Generate a LinkedIn post using the topic
		const linkedInPost = await openAiService.generateResponse({
			model: modelName,
			prompt: generateLinkedInPostPrompt,
			userMessage: `### TOPIC ## \n ${topicData.topic} \n
			### TOPIC DESCRIPTION ## \n ${topicData.topic_description} \n
			### RESEARCH ## \n ${topicData.research} \n`,
		});

		// Step 3: Post to LinkedIn (toggle with a flag for local testing)
		if (process.env.ENABLE_LINKEDIN_POST === 'true') {
			await linkedinService.postToLinkedIn(linkedInPost);
		} else {
			context.log('LinkedIn posting is disabled. Skipping Step 3.');
		}

		// Step 4: Save the LinkedIn post to Cosmos DB
		await cosmosService.createItem({
			topic: topicData.topic,
			topicDescription: topicData.topic_description,
			research: topicData.research,
			linkedInPost: linkedInPost,
			createdAt: createdAt,
		});

		return {
			topic: topicData.topic,
			topicDescription: topicData.topic_description,
			research: topicData.research,
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
