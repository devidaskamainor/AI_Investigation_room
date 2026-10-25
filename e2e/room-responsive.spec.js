import { test, expect } from '@playwright/test';
for (const width of [360, 768, 1440])
  test(`AC-21 investigation, viewer and results at ${width}px`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    let csrf = (await (await page.request.get('/api/v1/auth/csrf')).json()).data.csrfToken;
    const registered = await page.request.post('/api/v1/auth/register', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        name: 'Responsive Detective',
        email: `responsive-${width}-${Date.now()}@example.test`,
        password: 'test-password-42',
      },
    });
    expect(registered.status()).toBe(201);
    csrf = (await registered.json()).data.csrfToken;
    const created = await page.request.post('/api/v1/mysteries', {
        headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': `responsive-${width}-${Date.now()}` },
        data: {
          scenario: 'A sculpture vanishes during a private gallery exhibition.',
          difficulty: 'easy',
          mysteryType: 'theft',
          suspectCount: 3,
        },
      }),
      data = (await created.json()).data;
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/v1/generation-jobs/${data.jobId}`)).json()).data
            .status,
      )
      .toBe('completed');
    const base = `/mysteries/${data.mysteryId}`;
    await page.goto(base);
    await expect(
      page.getByRole('heading', { name: 'The Last Exhibition', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: /East gallery camera/ }).click();
    await expect(page.getByText('AI reconstruction, not real footage')).toBeVisible();
    await page.getByRole('button', { name: 'Next frame' }).click();
    await expect(page.getByRole('slider', { name: 'CCTV frame' })).toHaveValue('1');
    if (width <= 1000)
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    if (width <= 680) {
      await page.getByRole('button', { name: 'Board', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'New personal note' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    const suspects = (await (await page.request.get(`/api/v1${base}/suspects`)).json()).data.items,
      evidence = (await (await page.request.get(`/api/v1${base}/evidence`)).json()).data.items;
    const accused = await page.request.post(`/api/v1${base}/accusation`, {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        suspectId: suspects.find((s) => s.name === 'Ada Vale').id,
        motiveOptionId: 'M1',
        evidenceIds: evidence
          .filter((e) => ['The partnership conversation', 'A familiar coat'].includes(e.title))
          .map((e) => e.id),
      },
    });
    expect(accused.status()).toBe(200);
    await page.goto(`${base}/results`);
    await expect(
      page.getByRole('heading', { name: 'Master Detective', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
