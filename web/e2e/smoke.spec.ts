import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
	test('hero headline is visible', async ({ page }) => {
		await page.goto('/');
		// The h1 contains "Autonomous LinkedIn content"
		await expect(
			page.getByRole('heading', { level: 1, name: /autonomous linkedin content/i })
		).toBeVisible();
	});

	test('gallery renders at least one sample post card', async ({ page }) => {
		await page.goto('/');
		// Sample feed topic that should appear once the gallery loads
		await expect(
			page.getByText('Why Idempotency Keys Belong in Every Write API')
		).toBeVisible({ timeout: 10_000 });
	});

	test('dry-run panel generates a result when sample mode is on', async ({ page }) => {
		await page.goto('/');
		// Scroll to the #try section and click the generate button
		await page.locator('#try').scrollIntoViewIfNeeded();
		await page.getByRole('button', { name: /generate a sample post/i }).click();
		// The sample generatePreview takes ~1800ms; wait generously for the result
		await expect(
			page.getByText(/demo generations left today/i)
		).toBeVisible({ timeout: 15_000 });
	});
});
