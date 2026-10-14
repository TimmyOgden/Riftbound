import { test, expect } from '@playwright/test';
test('guests get every starter deck, track cards and keep them on this device', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My decks', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
  await expect(page.getByText('Playing as a guest. Your decks and cards are saved on this device only.', { exact: true })).toBeVisible();
  for (const name of ['Jinx - Origins', 'Rumble - Spiritforged', 'Fiora - Spiritforged', 'Vex - Unleashed', 'Vi - Unleashed', 'Shen - Vendetta', 'Zed - Vendetta']) await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My cards', exact: true }).click();
  await page.getByLabel('Search collection').fill('OGN-030');
  await page.getByRole('button', { name: 'Own more OGN-030', exact: true }).click();
  await expect(page.getByLabel('Owned copies OGN-030', { exact: true })).toHaveValue('1');
  await page.reload();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Guest account', exact: true })).toBeVisible();
  await expect(page.getByText(/1 owned cards$/)).toBeVisible();
  await page.getByRole('button', { name: 'Sign in or create an account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue as guest', exact: true })).toBeVisible();
});
