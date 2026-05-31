'use client';

import { useEffect, useState } from 'react';
import { getPosts } from '@/lib/api';
import { PublicPost } from '@/lib/types';
import PostCard from './PostCard';
import PostModal from './PostModal';

type Status = 'loading' | 'ready' | 'error';

function SkeletonGrid() {
	return (
		<div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				<div
					key={i}
					className="overflow-hidden rounded-xl border border-border bg-surface"
				>
					<div className="aspect-[16/9] animate-pulse bg-surface-2" />
					<div className="space-y-3 p-5">
						<div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
						<div className="h-3 w-full animate-pulse rounded bg-surface-2" />
						<div className="h-3 w-5/6 animate-pulse rounded bg-surface-2" />
					</div>
				</div>
			))}
		</div>
	);
}

function Notice({ message }: { message: string }) {
	return (
		<div className="mt-10 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
			<p className="font-mono text-sm text-muted">{message}</p>
		</div>
	);
}

export default function Gallery() {
	const [posts, setPosts] = useState<PublicPost[]>([]);
	const [token, setToken] = useState<string | undefined>();
	const [status, setStatus] = useState<Status>('loading');
	const [loadingMore, setLoadingMore] = useState(false);
	const [selected, setSelected] = useState<PublicPost | null>(null);

	useEffect(() => {
		let active = true;
		getPosts()
			.then(res => {
				if (!active) return;
				setPosts(res.posts);
				setToken(res.continuationToken);
				setStatus('ready');
			})
			.catch(() => active && setStatus('error'));
		return () => {
			active = false;
		};
	}, []);

	async function loadMore() {
		setLoadingMore(true);
		try {
			const res = await getPosts(12, token);
			setPosts(prev => [...prev, ...res.posts]);
			setToken(res.continuationToken);
		} catch {
			// keep what we have; surface nothing intrusive for a "load more" failure
		} finally {
			setLoadingMore(false);
		}
	}

	return (
		<section className="mx-auto max-w-6xl px-6 py-24">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="font-mono text-xs tracking-[0.25em] text-accent">
						{'// PRODUCTION FEED'}
					</p>
					<h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
						Posts it has shipped
					</h2>
				</div>
				<p className="hidden max-w-xs text-right text-sm text-muted sm:block">
					Real auto-generated posts, newest first, pulled live from Cosmos DB.
				</p>
			</div>

			{status === 'loading' && <SkeletonGrid />}
			{status === 'error' && (
				<Notice message="Could not reach the feed right now. Try again shortly." />
			)}
			{status === 'ready' && posts.length === 0 && (
				<Notice message="No posts yet. Check back after the next scheduled run." />
			)}
			{status === 'ready' && posts.length > 0 && (
				<>
					<div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{posts.map((post, i) => (
							<PostCard
								key={`${post.createdAt}-${i}`}
								post={post}
								onSelect={() => setSelected(post)}
							/>
						))}
					</div>
					{token && (
						<div className="mt-12 flex justify-center">
							<button
								onClick={loadMore}
								disabled={loadingMore}
								className="focus-accent rounded-lg border border-border-strong px-5 py-3 font-medium text-fg transition hover:border-accent hover:text-accent disabled:opacity-50"
							>
								{loadingMore ? 'Loading...' : 'Load more'}
							</button>
						</div>
					)}
				</>
			)}

			{selected && (
				<PostModal post={selected} onClose={() => setSelected(null)} />
			)}
		</section>
	);
}
