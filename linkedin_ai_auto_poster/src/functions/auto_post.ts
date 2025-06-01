import { app, InvocationContext, Timer } from '@azure/functions';
import { linkedInPostFlow } from '../flow/linkedin_post_flow';

// Improved error handling and logging
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
			schedule: process.env.LINKEDIN_POST_SCHEDULE || '0 0 16 * * *', // Timer schedule for reference
		});
		throw error; // Re-throw the error for monitoring or retries
	}
}

// Added comments for clarity
app.timer('linkedin_post_timer', {
	// Schedule: Every day at 9 AM
	schedule: process.env.LINKEDIN_POST_SCHEDULE || '0 0 16 * * *',
	handler: autoPostTimer,
});
