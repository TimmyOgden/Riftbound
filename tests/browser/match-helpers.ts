import { expect, type Page } from '@playwright/test';
// Follow real priority windows while exercising the live server and playback.
export async function settleMatch(page: Page) {
  const table = page.locator('.match-shell').filter({ visible: true });
  const playback = page.getByRole('region', { name: 'AI turn playback' });
  for (let step = 0; step < 80; step++) {
    if (await playback.isVisible()) {
      await playback.getByLabel('Speed').selectOption('fast');
      await expect(playback).toHaveCount(0);
      continue;
    }
    const pass = page.getByRole('button', { name: 'Pass priority', exact: true });
    const assign = page.getByRole('button', { name: 'Confirm damage order', exact: true });
    const button = await pass.isVisible() && await pass.isEnabled() ? pass : await assign.isVisible() && await assign.isEnabled() ? assign : undefined;
    if (button) {
      const revision = await table.getAttribute('data-revision');
      await button.click();
      await expect(table).not.toHaveAttribute('data-revision', revision!);
      continue;
    }
    if (await page.getByRole('button', { name: 'End turn', exact: true }).isEnabled()) return;
    await expect(async () => {
      expect(await playback.isVisible() || await pass.isVisible() && await pass.isEnabled() || await assign.isVisible() && await assign.isEnabled() || await page.getByRole('button', { name: 'End turn', exact: true }).isEnabled()).toBe(true);
    }).toPass({ timeout: 15000 });
  }
  throw Error('Match did not return to the main phase.');
}
