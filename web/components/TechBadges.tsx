import { TECH_BADGES } from '@/lib/site';

export default function TechBadges() {
	return (
		<ul className="flex flex-wrap gap-2">
			{TECH_BADGES.map(badge => (
				<li
					key={badge}
					className="rounded-full border border-border bg-surface/60 px-3 py-1 font-mono text-xs text-muted backdrop-blur-sm"
				>
					{badge}
				</li>
			))}
		</ul>
	);
}
