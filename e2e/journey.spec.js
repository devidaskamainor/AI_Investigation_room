import { test, expect } from '@playwright/test';
test('FR-01 through FR-61 full persisted detective journey', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Jordan Detective');
  await page.getByLabel('Email address').fill(`jordan-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-42');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your case files.' })).toBeVisible();
  await page.getByRole('link', { name: 'New investigation', exact: true }).last().click();
  await page.getByRole('button', { name: 'The missing artist' }).click();
  await page.getByRole('radio', { name: /easy/i }).check();
  await page.getByRole('button', { name: 'Build my mystery' }).click();
  await expect(page.getByRole('heading', { name: 'The Last Exhibition', exact: true })).toBeVisible(
    { timeout: 30000 },
  );
  const caseUrl = page.url();
  await page.getByRole('button', { name: /The partnership conversation/ }).click();
  await expect(
    page.getByText('AI-generated fictional conversation', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pin', exact: true }).click();
  await page.getByRole('button', { name: /Detective’s Board/ }).click();
  await page
    .getByRole('textbox', { name: 'New personal note' })
    .fill('The spare key connects access to opportunity.');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Edit personal note' })).toHaveValue(
    'The spare key connects access to opportunity.',
  );
  await page.getByRole('button', { name: /Hint 0/ }).click();
  await expect(page.getByRole('heading', { name: 'Hint 1 of 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the evidence' }).click();
  async function theory(suspect) {
    await page.getByRole('link', { name: 'Build a theory' }).click();
    await page.getByRole('radio', { name: suspect, exact: true }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('radio', { name: 'Retaliation over losing a partnership' }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('checkbox', { name: 'The partnership conversation', exact: true }).check();
    await page.getByRole('checkbox', { name: 'A familiar coat', exact: true }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Submit theory', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm accusation', exact: true }).click();
  }
  await theory('Ben Reed');
  await expect(page.getByRole('heading', { name: 'There’s more to this story.' })).toBeVisible();
  await expect(page.getByText('1 attempt remaining. The case is still open.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the case' }).click();
  await theory('Ada Vale');
  await expect(page.getByRole('heading', { name: 'Rookie Sleuth', exact: true })).toBeVisible();
  await expect(page.getByText('65', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Rookie Sleuth', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Reopen case file', exact: true }).click();
  await expect(page.getByText(/Investigation completed. Your saved theory/)).toBeVisible();
  await page.getByRole('button', { name: /Detective’s Board/ }).click();
  await expect(page.getByRole('textbox', { name: 'Edit personal note' })).toHaveValue(
    'The spare key connects access to opportunity.',
  );
  expect(
    await page.getByRole('textbox', { name: 'Edit personal note' }).getAttribute('readonly'),
  ).not.toBeNull();
  const id = new URL(caseUrl).pathname.split('/')[2],
    csrf = (await (await page.request.get('/api/v1/auth/csrf')).json()).data.csrfToken,
    suspects = (await (await page.request.get(`/api/v1/mysteries/${id}/suspects`)).json()).data
      .items,
    evidence = (await (await page.request.get(`/api/v1/mysteries/${id}/evidence`)).json()).data
      .items;
  const repeat = await page.request.post(`/api/v1/mysteries/${id}/accusation`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { suspectId: suspects[0].id, motiveOptionId: 'M1', evidenceIds: [evidence[0].id] },
  });
  expect(repeat.status()).toBe(409);
  expect(errors).toEqual([]);
});
