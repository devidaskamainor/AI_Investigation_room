import { test, expect } from '@playwright/test';
for (const width of [360, 768, 1440])
  test(`AC-21 landing and form at ${width}px`, async ({ page }) => {
    page.on('pageerror', (error) => console.error('Browser runtime:', error.message));
    await page.route('**/api/v1/auth/me', (r) =>
      r.fulfill({
        json: {
          success: true,
          data: {
            user: {
              id: '111111111111111111111111',
              name: 'Demo Detective',
              email: 'demo@example.test',
            },
          },
        },
      }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /A story begins/ })).toBeVisible();
    await expect(
      page.getByText('All cases, people, conversations and images are AI-generated fiction.'),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width === 1440 || width === 360)
      await page.screenshot({
        path: `docs/assets/landing-${width === 1440 ? 'desktop' : 'mobile'}.png`,
      });
    await page.goto('/mysteries/new');
    await expect(page.getByRole('button', { name: /Build my mystery/ })).toBeVisible();
    await page.getByRole('button', { name: /The missing artist/ }).click();
    await expect(page.getByLabel('What happened?')).not.toBeEmpty();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
