import {
	app,
	HttpRequest,
	HttpResponseInit,
	InvocationContext,
} from '@azure/functions';
import { linkedInPostFlow } from '../flow/linkedin_post_flow';

// Added comments to clarify purpose and safeguard against accidental deployment
/**
 * This function is a test tool to validate the LinkedIn post flow logic.
 * It is not intended for deployment to production.
 */

export async function testLinkedInPost(
	request: HttpRequest,
	context: InvocationContext
): Promise<HttpResponseInit> {
	try {
		context.log('Starting LinkedIn post test tool...');

		const enabledTesting = process.env.ENABLED_TEST_POST;

		context.log('Testing environment variable:', enabledTesting);

		if (!enabledTesting || enabledTesting !== 'true') {
			context.log('Testing is disabled. Exiting...');
			return {
				status: 403,
				body: JSON.stringify({
					error: 'Testing is disabled.',
					timestamp: new Date().toISOString(),
				}),
				headers: {
					'Content-Type': 'application/json',
				},
			};
		}
		const { topic, linkedInPost } = await linkedInPostFlow(context);

		context.log('LinkedIn post test tool completed successfully.');
		console.log('Generated LinkedIn post:', linkedInPost);

		return {
			status: 200,
			body: JSON.stringify({
				message: 'Generated and posted LinkedIn post',
				post: linkedInPost,
				topic: topic,
				timestamp: new Date().toISOString(),
			}),
			headers: {
				'Content-Type': 'application/json',
			},
		};
	} catch (error: any) {
		context.log('Error in LinkedIn post test tool:', {
			error: error.message,
			stack: error.stack,
		});

		return {
			status: 500,
			body: JSON.stringify({
				error: 'Error generating or posting LinkedIn post',
				details: error.message,
			}),
			headers: {
				'Content-Type': 'application/json',
			},
		};
	}
}

app.http('test_linkedin_post', {
	methods: ['GET'],
	authLevel: 'anonymous',
	handler: testLinkedInPost,
});
