import { PublicPost } from '@/lib/types';

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

export default function PostCard({
	post,
	onSelect,
}: {
	post: PublicPost;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-label={`Read post: ${post.topic}`}
			className="group focus-accent flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-accent/50 hover:shadow-[0_24px_64px_-20px_rgba(34,211,238,0.45)]"
		>
			{post.blobStorageUrl && (
				<div className="relative aspect-[16/9] overflow-hidden border-b border-border">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={post.blobStorageUrl}
						alt={`Cover image for ${post.topic}`}
						className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-bg/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
				</div>
			)}
			<div className="flex flex-1 flex-col p-5">
				<h3 className="clamp-2 font-display text-lg font-semibold leading-snug transition-colors duration-300 group-hover:text-accent">
					{post.topic}
				</h3>
				<p className="clamp-3 mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
					{post.linkedInPost}
				</p>
				<div className="relative mt-4 flex items-center justify-between border-t border-border/60 pt-3 font-mono text-[11px] text-muted">
					<span>{formatDate(post.createdAt)}</span>
					{post.triggerBy && (
						<span className="rounded border border-border px-1.5 py-0.5 text-accent/80 transition-opacity duration-300 group-hover:opacity-0">
							{post.triggerBy}
						</span>
					)}
					<span
						aria-hidden
						className="pointer-events-none absolute bottom-0 right-0 text-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
					>
						Read post {'->'}
					</span>
				</div>
			</div>
		</button>
	);
}
