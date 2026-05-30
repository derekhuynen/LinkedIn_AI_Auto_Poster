import { PostsResponse, PreviewResult } from './types';

export const SAMPLE_POSTS: PostsResponse = {
	posts: [
		{
			topic: 'Why Idempotency Keys Belong in Every Write API',
			topicDescription:
				'Designing retry-safe endpoints so duplicate requests never double-charge or double-post.',
			linkedInPost:
				'Most outages I have debugged were not caused by the failure itself. They were caused by the retry.\n\nWhen a client times out and retries a write, an API without idempotency keys happily creates a second record. Now you have two charges, two posts, two emails.\n\nThe fix is small: accept an Idempotency-Key header, store the first result against it, and replay that result on any retry with the same key. The client gets exactly-once semantics without you building a distributed transaction.',
			blobStorageUrl: '/samples/feed-01.svg',
			createdAt: '2026-05-28T09:00:00.000Z',
			triggerBy: 'timer',
		},
		{
			topic: 'Vector Databases Are Just Indexes With Better PR',
			topicDescription:
				'A grounded look at when approximate nearest neighbor search actually earns its keep.',
			linkedInPost:
				'Every team I talk to wants a vector database. Half of them have under 50,000 documents.\n\nAt that scale, a brute-force cosine similarity in memory returns in single-digit milliseconds. You do not need an ANN index, a new service, or a new bill.\n\nReach for a dedicated vector store when your corpus and query volume actually demand it, not because the architecture diagram looks more impressive with one in it.',
			blobStorageUrl: '/samples/feed-02.svg',
			createdAt: '2026-05-27T09:00:00.000Z',
			triggerBy: 'timer',
		},
		{
			topic: 'The Cheapest Observability Win: Structured Logs',
			topicDescription:
				'Trading printf debugging for queryable JSON events you can actually alert on.',
			linkedInPost:
				'You do not need a tracing vendor to ten-x your debugging. You need to stop logging strings.\n\nThe moment your logs become JSON with a stable schema, every field is filterable, every error is groupable, and every latency spike is a query away. Add a request id and you can follow one user through the whole system.\n\nStructured logging is the highest-leverage day-one investment most teams skip.',
			blobStorageUrl: '/samples/feed-03.svg',
			createdAt: '2026-05-26T09:00:00.000Z',
			triggerBy: 'timer',
		},
		{
			topic: 'Serverless Is Not About Servers, It Is About Ownership',
			topicDescription:
				'Reframing the trade-offs of functions-as-a-service around operational burden, not infrastructure.',
			linkedInPost:
				'The serverless debate keeps getting stuck on cold starts. That is the wrong axis.\n\nThe real question is who carries the pager for the host OS, the runtime patches, and the autoscaler. With functions, that is the platform, not you. You trade some control and some tail latency for a much smaller operational surface.\n\nDecide based on what you want to stop owning, not on a benchmark.',
			blobStorageUrl: '/samples/feed-04.svg',
			createdAt: '2026-05-25T09:00:00.000Z',
			triggerBy: 'timer',
		},
	],
	continuationToken: undefined,
};

export const SAMPLE_PREVIEW: PreviewResult = {
	topic: 'Backpressure Is a Feature, Not a Bug',
	topicDescription:
		'Why letting a queue say "no" protects the whole system from cascading failure.',
	linkedInPost:
		'A queue that never pushes back is a queue that is lying to you.\n\nWhen producers outpace consumers and nothing slows them down, latency climbs silently until the whole pipeline tips over at once. Backpressure turns that cliff into a gentle slope: the system sheds or delays load deliberately instead of collapsing.\n\nThe next time you design a pipeline, decide where it is allowed to say no. That decision is your reliability budget.',
	imageUrl: '/samples/feed-02.svg',
	createdAt: '2026-05-29T12:00:00.000Z',
	remaining: 49,
};
