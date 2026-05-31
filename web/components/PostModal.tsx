'use client';

import { useEffect, useRef } from 'react';
import { PublicPost } from '@/lib/types';

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	});
}

export default function PostModal({
	post,
	onClose,
}: {
	post: PublicPost;
	onClose: () => void;
}) {
	const closeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		closeRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [onClose]);

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={post.topic}
			onClick={onClose}
			className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
		>
			<div
				onClick={e => e.stopPropagation()}
				className="modal-panel relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]"
			>
				<button
					ref={closeRef}
					onClick={onClose}
					aria-label="Close"
					className="focus-accent absolute right-3 top-3 z-10 rounded-lg border border-border bg-bg/60 px-2.5 py-1 font-mono text-sm text-muted backdrop-blur transition hover:border-accent hover:text-accent"
				>
					{'✕'}
				</button>

				{post.blobStorageUrl && (
					<div className="aspect-[16/9] w-full shrink-0 overflow-hidden border-b border-border">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={post.blobStorageUrl}
							alt={`Cover image for ${post.topic}`}
							className="h-full w-full object-cover"
						/>
					</div>
				)}

				<div className="flex-1 overflow-y-auto p-6 sm:p-8">
					<p className="font-mono text-[11px] tracking-wide text-accent">
						{`// ${post.triggerBy ? post.triggerBy.toUpperCase() : 'POST'}`}
					</p>
					<h3 className="mt-2 font-display text-2xl font-bold leading-snug">
						{post.topic}
					</h3>
					{post.topicDescription && (
						<p className="mt-2 text-sm text-muted">{post.topicDescription}</p>
					)}
					<p className="mt-5 whitespace-pre-line leading-relaxed text-fg/90">
						{post.linkedInPost}
					</p>
					<div className="mt-6 border-t border-border/60 pt-3 font-mono text-[11px] text-muted">
						{formatDate(post.createdAt)}
					</div>
				</div>
			</div>
		</div>
	);
}
