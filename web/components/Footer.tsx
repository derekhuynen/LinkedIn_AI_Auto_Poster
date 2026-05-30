import { GITHUB_URL } from '@/lib/site';

export default function Footer() {
	return (
		<footer className="border-t border-border">
			<div className="mx-auto max-w-6xl px-6 py-12">
				<div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
					<p className="max-w-xl font-mono text-xs leading-relaxed text-muted">
						{
							'// Azure Functions (timer) -> GPT-4.1 + DALL-E 3 -> Blob Storage + Cosmos DB -> LinkedIn'
						}
					</p>
					<div className="flex items-center gap-5 text-sm">
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="text-muted transition hover:text-accent"
						>
							GitHub
						</a>
						<a
							href={`${GITHUB_URL}#readme`}
							target="_blank"
							rel="noopener noreferrer"
							className="text-muted transition hover:text-accent"
						>
							Docs
						</a>
					</div>
				</div>
				<p className="mt-8 text-xs text-muted">
					Built by Derek Huynen. Demo previews are rate-capped and never
					published to LinkedIn.
				</p>
			</div>
		</footer>
	);
}
