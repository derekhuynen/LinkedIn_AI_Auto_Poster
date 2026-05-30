import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	use: {
		baseURL: 'http://localhost:3001',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'next dev -p 3001',
		url: 'http://localhost:3001',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			NEXT_PUBLIC_USE_SAMPLE_DATA: 'true',
		},
	},
});
