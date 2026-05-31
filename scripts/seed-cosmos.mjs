// Seeds the gallery container from pre-saved example content so the dashboard looks
// populated immediately. The examples (web/lib/examples.json) are real pipeline output
// captured once; the cover images live in web/public/samples and are served by the
// Static Web App at /samples/*.png. No live generation, no model access needed.
//
// Required env: COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE_ID, COSMOS_LINKEDIN_CONTAINER.
//
//   node scripts/seed-cosmos.mjs

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { CosmosClient } = require(join(root, 'api', 'node_modules', '@azure', 'cosmos'));

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE_ID || 'AutoPoster';
const containerId = process.env.COSMOS_LINKEDIN_CONTAINER || 'LinkedInPosts';
if (!endpoint || !key) {
	console.error('Missing COSMOS_ENDPOINT or COSMOS_KEY in the environment.');
	process.exit(1);
}

const examples = JSON.parse(
	readFileSync(join(root, 'web', 'lib', 'examples.json'), 'utf-8')
);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = i => new Date(now - i * DAY).toISOString();

const cosmos = new CosmosClient({ endpoint, key });
const container = cosmos.database(databaseId).container(containerId);

// Clear existing posts so re-runs do not duplicate the gallery.
const existing = await container.items
	.query('SELECT c.id FROM c WHERE c.topic != null')
	.fetchAll();
for (const doc of existing.resources) {
	await container.item(doc.id, doc.id).delete();
}
console.log(`Cleared ${existing.resources.length} existing post(s).`);

let created = 0;
for (const ex of examples) {
	await container.items.create({
		topic: ex.topic,
		topicDescription: ex.topicDescription,
		linkedInPost: ex.linkedInPost,
		blobStorageUrl: `/samples/${ex.image}`,
		createdAt: iso(created),
		triggerBy: 'timer',
	});
	created++;
	console.log(`  seeded: ${ex.topic}`);
}
console.log(`Seeded ${created} example posts into ${databaseId}/${containerId}.`);
