// Seeds the gallery container with a few sample posts so the deployed dashboard
// looks populated immediately, without waiting for a scheduled run or posting to
// LinkedIn. The cover images point at /samples/*.svg, which the Static Web App
// serves same-origin.
//
// Reads COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE_ID, COSMOS_LINKEDIN_CONTAINER
// from the environment. Run from the `api/` directory so `@azure/cosmos` resolves.
//
//   node ../scripts/seed-cosmos.mjs

import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE_ID || 'AutoPoster';
const containerId = process.env.COSMOS_LINKEDIN_CONTAINER || 'LinkedInPosts';

if (!endpoint || !key) {
	console.error('Missing COSMOS_ENDPOINT or COSMOS_KEY in the environment.');
	process.exit(1);
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = offsetDays => new Date(now - offsetDays * DAY).toISOString();

const posts = [
	{
		topic: 'Why Idempotency Keys Belong in Every Write API',
		topicDescription:
			'Designing retry-safe endpoints so duplicate requests never double-charge or double-post.',
		linkedInPost:
			'Most outages I have debugged were not caused by the failure itself. They were caused by the retry.\n\nWhen a client times out and retries a write, an API without idempotency keys happily creates a second record. The fix is small: accept an Idempotency-Key header, store the first result against it, and replay that result on any retry with the same key.',
		blobStorageUrl: '/samples/feed-01.svg',
		createdAt: iso(1),
		triggerBy: 'timer',
	},
	{
		topic: 'Vector Databases Are Just Indexes With Better PR',
		topicDescription:
			'A grounded look at when approximate nearest neighbor search actually earns its keep.',
		linkedInPost:
			'Every team I talk to wants a vector database. Half of them have under 50,000 documents.\n\nAt that scale, a brute-force cosine similarity in memory returns in single-digit milliseconds. Reach for a dedicated vector store when your corpus and query volume actually demand it, not because the diagram looks more impressive with one in it.',
		blobStorageUrl: '/samples/feed-02.svg',
		createdAt: iso(2),
		triggerBy: 'timer',
	},
	{
		topic: 'The Cheapest Observability Win: Structured Logs',
		topicDescription:
			'Trading printf debugging for queryable JSON events you can actually alert on.',
		linkedInPost:
			'You do not need a tracing vendor to ten-x your debugging. You need to stop logging strings.\n\nThe moment your logs become JSON with a stable schema, every field is filterable and every latency spike is a query away. Add a request id and you can follow one user through the whole system.',
		blobStorageUrl: '/samples/feed-03.svg',
		createdAt: iso(3),
		triggerBy: 'timer',
	},
	{
		topic: 'Serverless Is Not About Servers, It Is About Ownership',
		topicDescription:
			'Reframing the trade-offs of functions-as-a-service around operational burden.',
		linkedInPost:
			'The serverless debate keeps getting stuck on cold starts. That is the wrong axis.\n\nThe real question is who carries the pager for the host OS, the runtime patches, and the autoscaler. With functions, that is the platform, not you. Decide based on what you want to stop owning, not on a benchmark.',
		blobStorageUrl: '/samples/feed-04.svg',
		createdAt: iso(4),
		triggerBy: 'timer',
	},
];

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container(containerId);

let created = 0;
for (const post of posts) {
	await container.items.create(post);
	created++;
	console.log(`  seeded: ${post.topic}`);
}
console.log(`Seeded ${created} sample posts into ${databaseId}/${containerId}.`);
