import * as axios from 'axios';

class LinkedinService {
	private accessToken: string | null;

	constructor() {
		this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || null;
	}

	// Add a method to set the access token manually
	setAccessToken(token: string): void {
		this.accessToken = token;
	}

	// Step 3: Post to LinkedIn
	async postToLinkedIn(content: string): Promise<void> {
		// Enhanced environment variable validation
		if (!this.accessToken) {
			throw new Error(
				'Access token is not available. Ensure LINKEDIN_ACCESS_TOKEN is set in environment variables.'
			);
		}

		const memberUrn = process.env.LINKEDIN_MEMBER_URN;
		if (!memberUrn) {
			throw new Error(
				'LinkedIn member URN is not defined. Ensure LINKEDIN_MEMBER_URN is set in environment variables.'
			);
		}

		// Refactored URL to use an environment variable or default value
		const url =
			process.env.LINKEDIN_API_URL || 'https://api.linkedin.com/v2/ugcPosts';
		const headers = {
			Authorization: `Bearer ${this.accessToken}`,
			'Content-Type': 'application/json',
			'X-Restli-Protocol-Version': '2.0.0',
		};

		const body = {
			author: memberUrn,
			lifecycleState: 'PUBLISHED',
			specificContent: {
				'com.linkedin.ugc.ShareContent': {
					shareCommentary: {
						text: content,
					},
					shareMediaCategory: 'NONE',
				},
			},
			visibility: {
				'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
			},
		};

		try {
			await axios.post(url, body, { headers });
			console.log('Post successfully created on LinkedIn');
		} catch (error) {
			// Improved error logging with additional context
			console.error('Error posting to LinkedIn:', {
				error: error.message,
				stack: error.stack,
				url: url,
				body: body,
			});
			throw new Error('Failed to post to LinkedIn');
		}
	}
}

export default LinkedinService;
