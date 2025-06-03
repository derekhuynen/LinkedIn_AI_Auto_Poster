import { app, InvocationContext, Timer } from '@azure/functions';
import { linkedInPostFlow } from '../flow/linkedin_post_flow';

/**
 * Azure Function timer trigger for automated LinkedIn posting.
 * Runs the LinkedIn post flow on the schedule defined by the LINKEDIN_POST_SCHEDULE environment variable.
 *
 * @param {Timer} myTimer - The Azure Functions timer object
 * @param {InvocationContext} context - The Azure Functions invocation context
 * @returns {Promise<void>} Resolves when the post flow completes
 * @throws {Error} If the post flow fails
 */
export async function autoPostTimer(
	myTimer: Timer,
	context: InvocationContext
): Promise<void> {
	try {
		context.log('Starting LinkedIn auto-post flow...');
		await linkedInPostFlow(context, 'timer');
		context.log('LinkedIn auto-post flow completed successfully.');
	} catch (error: any) {
		context.log('Error during LinkedIn auto-post flow execution:', {
			error: error.message,
			stack: error.stack,
			schedule: process.env.LINKEDIN_POST_SCHEDULE,
		});
		throw error;
	}
}

const schedule = process.env.LINKEDIN_POST_SCHEDULE;
if (schedule) {
	app.timer('linkedin_post_timer', {
		schedule,
		handler: autoPostTimer,
	});
}
