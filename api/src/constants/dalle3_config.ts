/**
 * DALL-E 3 Configuration Settings
 *
 * This file contains additional configuration options for DALL-E 3 image generation.
 * It complements the basic model information defined in constants.ts.
 */

/**
 * Default prompt suffix that gets appended to all DALL-E 3 prompts
 * to maintain consistent style and quality
 */
export const DEFAULT_PROMPT_SUFFIX =
	'The image should be professional, high-quality, and suitable for LinkedIn. ' +
	'Use a clean, modern style with professional color scheme. ' +
	'Make sure the image is clear and readable on mobile devices.';

/**
 * Image size options for DALL-E 3
 */
export enum DallE3Size {
	SQUARE = '1024x1024',
	LANDSCAPE = '1792x1024',
	PORTRAIT = '1024x1792',
}

/**
 * Image quality options for DALL-E 3
 */
export enum DallE3Quality {
	STANDARD = 'standard',
	HD = 'hd',
}

/**
 * Image style options for DALL-E 3
 */
export enum DallE3Style {
	VIVID = 'vivid',
	NATURAL = 'natural',
}

/**
 * Default settings for LinkedIn post images
 */
export const LINKEDIN_IMAGE_DEFAULTS = {
	size: DallE3Size.LANDSCAPE,
	quality: DallE3Quality.STANDARD,
	style: DallE3Style.VIVID,
};

/**
 * Helper function to enhance a prompt with style guidance
 * @param prompt The base prompt to enhance
 * @returns Enhanced prompt with style guidelines
 */
export function enhancePrompt(prompt: string): string {
	// Don't add the suffix if it's already there
	if (prompt.includes(DEFAULT_PROMPT_SUFFIX)) {
		return prompt;
	}

	return `${prompt.trim()} ${DEFAULT_PROMPT_SUFFIX}`;
}
