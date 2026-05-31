import {
	app,
	HttpRequest,
	HttpResponseInit,
	InvocationContext,
} from '@azure/functions';
import { CosmosService } from '../service/CosmosService';
import { PublicPost } from '../types/PublicPost';
import {
	PUBLIC_POSTS_QUERY,
	DEFAULT_POSTS_PAGE_SIZE,
} from '../constants/constants';

/**
 * GET /api/posts -- public, read-only gallery feed of real auto-posted content.
 * Returns a trimmed projection (no secrets) plus a continuation token for paging.
 *
 * Query params:
 *   limit              - page size (default DEFAULT_POSTS_PAGE_SIZE)
 *   continuationToken  - Cosmos continuation token from a previous page
 */
export async function getPosts(
	request: HttpRequest,
	context: InvocationContext
): Promise<HttpResponseInit> {
	try {
		const containerId = process.env.COSMOS_LINKEDIN_CONTAINER;
		if (!containerId) {
			throw new Error('COSMOS_LINKEDIN_CONTAINER environment variable is not set');
		}

		const limitParam = request.query.get('limit');
		const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
		const limit =
			Number.isFinite(parsedLimit) && parsedLimit > 0
				? parsedLimit
				: DEFAULT_POSTS_PAGE_SIZE;

		const continuationToken =
			request.query.get('continuationToken') || undefined;

		const cosmosService = new CosmosService<PublicPost>({ containerId });
		const { items, continuationToken: nextToken } =
			await cosmosService.queryItemsWithPagination(PUBLIC_POSTS_QUERY, {
				limit,
				continuationToken,
			});

		return {
			status: 200,
			jsonBody: {
				posts: items,
				continuationToken: nextToken,
			},
		};
	} catch (error: any) {
		context.log('Error in getPosts:', {
			error: error.message,
			stack: error.stack,
		});
		return {
			status: 500,
			jsonBody: { error: 'Failed to load posts' },
		};
	}
}

app.http('get_posts', {
	methods: ['GET'],
	authLevel: 'anonymous',
	route: 'posts',
	handler: getPosts,
});
