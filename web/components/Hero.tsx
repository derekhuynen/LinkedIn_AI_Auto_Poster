import type { CSSProperties } from 'react';
import { GITHUB_URL } from '@/lib/site';
import TechBadges from './TechBadges';

const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as CSSProperties;

export default function Hero() {
	return (
		<header className="grain relative overflow-hidden border-b border-border">
			<div className="hero-mesh absolute inset-0" />
			<div className="grid-texture absolute inset-0 opacity-60" />
			<div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

			<div className="relative mx-auto max-w-5xl px-6 pb-24 pt-28 sm:pb-28 sm:pt-36">
				<p
					className="reveal font-mono text-xs tracking-[0.25em] text-accent"
					style={delay(0)}
				>
					{'// AI CONTENT PIPELINE'}
				</p>

				<h1
					className="reveal mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-6xl"
					style={delay(90)}
				>
					Autonomous LinkedIn content,
					<br className="hidden sm:block" />{' '}
					<span className="text-accent">generated and shipped</span> on Azure.
				</h1>

				<p
					className="reveal mt-7 max-w-2xl text-lg leading-relaxed text-muted"
					style={delay(180)}
				>
					A timer-triggered pipeline picks a fresh topic, writes the post with
					gpt-5-mini, generates a cover image with gpt-image-1, and publishes
					straight to LinkedIn. Every run is archived to Cosmos DB.
				</p>

				<div
					className="reveal mt-9 flex flex-wrap items-center gap-3"
					style={delay(270)}
				>
					<a
						href="#try"
						className="focus-accent inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-medium text-bg transition hover:brightness-110"
					>
						Try it live
						<span aria-hidden className="font-mono text-sm">
							{'->'}
						</span>
					</a>
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="focus-accent inline-flex items-center gap-2 rounded-lg border border-border-strong px-5 py-3 font-medium text-fg transition hover:border-accent hover:text-accent"
					>
						View source
					</a>
				</div>

				<div className="reveal mt-12" style={delay(360)}>
					<TechBadges />
				</div>
			</div>
		</header>
	);
}
