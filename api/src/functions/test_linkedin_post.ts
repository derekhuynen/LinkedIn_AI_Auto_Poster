import {
	app,
	HttpRequest,
	HttpResponseInit,
	InvocationContext,
} from '@azure/functions';
import { linkedInPostFlow } from '../flow/linkedin_post_flow';

/**
 * Azure Function to test the LinkedIn post flow logic.
 * Not intended for production deployment.
 *
 * @param {HttpRequest} request - The HTTP request object
 * @param {InvocationContext} context - The Azure Functions invocation context
 * @returns {Promise<HttpResponseInit>} The HTTP response with test results or error details
 */
export async function testLinkedInPost(
	request: HttpRequest,
	context: InvocationContext
): Promise<HttpResponseInit> {
	try {
		context.log('Starting LinkedIn post test tool...');
		const enabledTesting = process.env.ENABLED_TEST_POST;
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
		const { topic, linkedInPost } = await linkedInPostFlow(context, 'http');
		context.log('LinkedIn post test tool completed successfully.');
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
