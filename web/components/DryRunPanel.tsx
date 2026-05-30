'use client';

import { useState } from 'react';
import { generatePreview } from '@/lib/api';
import { PreviewResult, RateLimitError } from '@/lib/types';

type State =
	| { kind: 'idle' }
	| { kind: 'loading' }
	| { kind: 'success'; result: PreviewResult }
	| { kind: 'capped'; resetsAt: string }
	| { kind: 'error' };

function formatReset(iso: string): string {
	if (!iso) return 'tomorrow';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return 'tomorrow';
	return d.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short',
	});
}

export default function DryRunPanel() {
	const [state, setState] = useState<State>({ kind: 'idle' });

	async function run() {
		setState({ kind: 'loading' });
		try {
			const result = await generatePreview();
			setState({ kind: 'success', result });
		} catch (err) {
			if (err instanceof RateLimitError) {
				setState({ kind: 'capped', resetsAt: err.resetsAt });
			} else {
				setState({ kind: 'error' });
			}
		}
	}

	const busy = state.kind === 'loading';
	const disabled = busy || state.kind === 'capped';

	return (
		<section id="try" className="border-y border-border bg-surface/30">
			<div className="mx-auto max-w-5xl px-6 py-24">
				<div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
					{/* Left: pitch + control */}
					<div className="lg:max-w-sm lg:pt-2">
						<p className="font-mono text-xs tracking-[0.25em] text-accent">
							{'// LIVE DRY-RUN'}
						</p>
						<h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
							Watch it write one now
						</h2>
						<p className="mt-4 text-muted">
							Run the real pipeline on demand. It generates a topic, a post, and
							a cover image with the same models the scheduler uses.
						</p>

						<button
							onClick={run}
							disabled={disabled}
							className="focus-accent mt-7 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{busy ? (
								<>
									<span className="pulse-soft">Generating</span>
									<span className="pulse-soft font-mono">...</span>
								</>
							) : (
								<>
									Generate a sample post
									<span aria-hidden className="font-mono text-sm">
										{'->'}
									</span>
								</>
							)}
						</button>

						<p className="mt-4 font-mono text-xs text-muted">
							{'// nothing is published to LinkedIn'}
						</p>
					</div>

					{/* Right: result surface */}
					<div className="lg:flex-1">
						<ResultSurface state={state} />
					</div>
				</div>
			</div>
		</section>
	);
}

function ResultSurface({ state }: { state: State }) {
	if (state.kind === 'idle') {
		return (
			<div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
				<p className="max-w-xs font-mono text-sm text-muted">
					The generated post will appear here, image and all.
				</p>
			</div>
		);
	}

	if (state.kind === 'loading') {
		return (
			<div className="overflow-hidden rounded-xl border border-border bg-surface">
				<div className="aspect-[16/9] animate-pulse bg-surface-2" />
				<div className="space-y-3 p-6">
					<div className="h-5 w-2/3 animate-pulse rounded bg-surface-2" />
					<div className="h-3 w-full animate-pulse rounded bg-surface-2" />
					<div className="h-3 w-11/12 animate-pulse rounded bg-surface-2" />
					<div className="h-3 w-4/5 animate-pulse rounded bg-surface-2" />
				</div>
			</div>
		);
	}

	if (state.kind === 'capped') {
		return (
			<div className="flex min-h-[20rem] flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 text-center">
				<p className="font-display text-xl font-semibold">
					Daily demo limit reached
				</p>
				<p className="mt-3 max-w-xs text-sm text-muted">
					The live demo has a global daily cap to keep costs predictable. It
					resets {formatReset(state.resetsAt)}.
				</p>
				<p className="mt-5 font-mono text-xs text-muted">
					{'// the scheduler keeps running regardless'}
				</p>
			</div>
		);
	}

	if (state.kind === 'error') {
		return (
			<div className="flex min-h-[20rem] flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 text-center">
				<p className="font-display text-xl font-semibold">
					Something went wrong
				</p>
				<p className="mt-3 max-w-xs text-sm text-muted">
					The generation did not complete. Give it another try.
				</p>
			</div>
		);
	}

	const { result } = state;
	return (
		<figure className="overflow-hidden rounded-xl border border-border bg-surface">
			{result.imageUrl && (
				<div className="aspect-[16/9] overflow-hidden border-b border-border">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={result.imageUrl}
						alt=""
						className="h-full w-full object-cover"
					/>
				</div>
			)}
			<figcaption className="p-6">
				<p className="font-mono text-[11px] tracking-wide text-accent">
					{'// GENERATED TOPIC'}
				</p>
				<h3 className="mt-2 font-display text-xl font-semibold leading-snug">
					{result.topic}
				</h3>
				<p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg/90">
					{result.linkedInPost}
				</p>
				<div className="mt-5 border-t border-border/60 pt-3 font-mono text-[11px] text-muted">
					{'// '}
					{result.remaining} demo generations left today
				</div>
			</figcaption>
		</figure>
	);
}
