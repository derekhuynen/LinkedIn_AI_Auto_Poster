import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// Fully static export for Azure Static Web Apps.
	output: 'export',
	// No Next image optimizer in a static export.
	images: { unoptimized: true },
};

export default nextConfig;
