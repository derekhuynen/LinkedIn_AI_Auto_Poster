import * as axios from 'axios';
import { createReadStream } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Service for interacting with the LinkedIn API, including posting content and uploading images.
 */
class LinkedinService {
	private accessToken: string | null;

	/**
	 * Initializes the LinkedIn service with the access token from environment variables.
	 */
	constructor() {
		this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || null;
	}

	/**
	 * Manually set the LinkedIn access token.
	 * @param {string} token - The LinkedIn access token.
	 */
	setAccessToken(token: string): void {
		this.accessToken = token;
	}

	/**
	 * Uploads an image to LinkedIn and returns the media URN.
	 * @param {Buffer} imageBuffer - Image data as buffer.
	 * @param {string} [filename] - Name for the uploaded file.
	 * @returns {Promise<string>} Media URN for the uploaded image.
	 * @throws {Error} If upload fails or required environment variables are missing.
	 */
	async uploadImageToLinkedIn(
		imageBuffer: Buffer,
		filename: string = 'linkedin-post-image.jpg'
	): Promise<string> {
		if (!this.accessToken) {
			throw new Error('Access token is not available for image upload');
		}

		const memberUrn = process.env.LINKEDIN_MEMBER_URN;
		if (!memberUrn) {
			throw new Error('LinkedIn member URN is not defined for image upload');
		}

		try {
			// Step 1: Initialize upload
			const initializeUrl =
				'https://api.linkedin.com/v2/assets?action=registerUpload';
			const initializeHeaders = {
				Authorization: `Bearer ${this.accessToken}`,
				'Content-Type': 'application/json',
			};

			const initializeBody = {
				registerUploadRequest: {
					recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
					owner: memberUrn,
					serviceRelationships: [
						{
							relationshipType: 'OWNER',
							identifier: 'urn:li:userGeneratedContent',
						},
					],
				},
			};
			const initResponse = await axios.post(initializeUrl, initializeBody, {
				headers: initializeHeaders,
			});
			const responseData = initResponse.data as any;
			const uploadUrl =
				responseData.value.uploadMechanism[
					'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
				].uploadUrl;
			const asset = responseData.value.asset;

			// Step 2: Upload image binary data
			const uploadHeaders = {
				Authorization: `Bearer ${this.accessToken}`,
				'Content-Type': 'application/octet-stream',
			};

			await axios.put(uploadUrl, imageBuffer, { headers: uploadHeaders });

			console.log('Image successfully uploaded to LinkedIn');
			return asset;
		} catch (error: any) {
			console.error('Error uploading image to LinkedIn:', {
				error: error.message,
				stack: error.stack,
				filename,
			});
			throw new Error(`Failed to upload image to LinkedIn: ${error.message}`);
		}
	}

	/**
	 * Posts content to LinkedIn, optionally with an image.
	 * @param {string} content - The text content to post.
	 * @param {string} [imageAsset] - The LinkedIn media asset URN for the image.
	 * @returns {Promise<void>}
	 * @throws {Error} If posting fails or required environment variables are missing.
	 */
	async postToLinkedIn(content: string, imageAsset?: string): Promise<void> {
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
					shareMediaCategory: imageAsset ? 'IMAGE' : 'NONE',
					...(imageAsset && {
						media: [
							{
								status: 'READY',
								description: {
									text: 'AI-generated image for LinkedIn post',
								},
								media: imageAsset,
								title: {
									text: 'LinkedIn Post Image',
								},
							},
						],
					}),
				},
			},
			visibility: {
				'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
			},
		};
		try {
			await axios.post(url, body, { headers });
			console.log(
				`Post successfully created on LinkedIn${
					imageAsset ? ' with image' : ''
				}`
			);
		} catch (error: any) {
			// Improved error logging with additional context
			console.error('Error posting to LinkedIn:', {
				error: error.message,
				stack: error.stack,
				url: url,
				body: body,
				hasImage: !!imageAsset,
			});
			throw new Error('Failed to post to LinkedIn');
		}
	}
}

export default LinkedinService;
