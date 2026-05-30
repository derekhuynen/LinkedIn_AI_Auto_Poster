import { PublicPost } from '@/lib/types';

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

export default function PostCard({ post }: { post: PublicPost }) {
	return (
		<article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_18px_50px_-18px_rgba(34,211,238,0.35)]">
			{post.blobStorageUrl && (
				<div className="aspect-[16/9] overflow-hidden border-b border-border">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={post.blobStorageUrl}
						alt=""
						className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
					/>
				</div>
			)}
			<div className="flex flex-1 flex-col p-5">
				<h3 className="clamp-2 font-display text-lg font-semibold leading-snug">
					{post.topic}
				</h3>
				<p className="clamp-3 mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
					{post.linkedInPost}
				</p>
				<div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 font-mono text-[11px] text-muted">
					<span>{formatDate(post.createdAt)}</span>
					{post.triggerBy && (
						<span className="rounded border border-border px-1.5 py-0.5 text-accent/80">
							{post.triggerBy}
						</span>
					)}
				</div>
			</div>
		</article>
	);
}
