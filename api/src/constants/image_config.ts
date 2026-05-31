/**
 * Image generation configuration (gpt-image-1).
 *
 * The app targets Azure OpenAI's gpt-image-1, which returns base64 image data.
 * (DALL-E 3 was retired on Azure in 2026.) Image generation is opt-in via the
 * ENABLE_IMAGE_GENERATION flag and a deployed gpt-image-1 model.
 */

/** Style guidance appended to every image prompt for a consistent, professional look. */
export const DEFAULT_PROMPT_SUFFIX =
	'The image should be professional, high-quality, and suitable for LinkedIn. ' +
	'Use a clean, modern style with a professional color scheme. ' +
	'Make sure the image is clear and readable on mobile devices.';

/** Supported gpt-image-1 sizes. */
export enum ImageSize {
	SQUARE = '1024x1024',
	LANDSCAPE = '1536x1024',
	PORTRAIT = '1024x1536',
}

/** Supported gpt-image-1 quality tiers. */
export enum ImageQuality {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
}

/**
 * Default settings for LinkedIn post cover images. Kept fast and cheap (low quality,
 * square) so the synchronous dry-run request stays well under the browser/gateway
 * timeout window; raise these for the scheduled timer path if you want richer images.
 */
export const LINKEDIN_IMAGE_DEFAULTS = {
	size: ImageSize.SQUARE,
	quality: ImageQuality.LOW,
};

/**
 * Appends the style suffix to a prompt (idempotently).
 * @param prompt The base prompt to enhance.
 * @returns The prompt with style guidance.
 */
export function enhancePrompt(prompt: string): string {
	if (prompt.includes(DEFAULT_PROMPT_SUFFIX)) {
		return prompt;
	}
	return `${prompt.trim()} ${DEFAULT_PROMPT_SUFFIX}`;
}
