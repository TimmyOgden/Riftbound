import { settleMatch } from './match-helpers.ts';
import { test, expect } from '@playwright/test';

test('Chrome: invalid drop, drag to play, exhausted rejection and drag to move', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter the Rift' })).toBeEnabled();
  await page.getByRole('combobox').first().selectOption('proving-grounds-lux');
  await page.getByRole('button', { name: 'Enter the Rift' }).click();
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await settleMatch(page);
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
  const champion = page.getByRole('button', { name: /Select chosen champion/ });
  await champion.dragTo(page.locator('.opponent-base'));
  await expect(champion).toBeVisible();
  await expect(page.locator('.your-base .table-unit')).toHaveCount(0);
  await expect(page.locator('.drag-card-ghost')).toHaveCount(0);
  await champion.dragTo(page.locator('.your-base'));
  await expect(page.locator('.your-base .table-unit')).toHaveCount(1);
  await expect(champion).toHaveCount(0);
  await page.locator('.your-base .table-unit').dragTo(page.locator('.field-zone').first());
  await expect(page.locator('.your-base .table-unit')).toHaveCount(1);
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await settleMatch(page);
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
  await page.locator('.your-base .table-unit').dragTo(page.locator('.field-zone').first());
  await expect(page.locator('.your-base .table-unit')).toHaveCount(0);
  await expect(page.locator('.drag-card-ghost')).toHaveCount(0);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.history-panel li').filter({ hasText: 'You plays Lux' })).toHaveCount(1);
  await expect(page.locator('.history-panel li').filter({ hasText: 'You moves Lux' })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Chrome: drag preview, Escape cancellation and Shift-drop Accelerate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter the Rift' })).toBeEnabled();
  await page.getByRole('combobox').first().selectOption('origins-lee-sin');
  await page.getByRole('combobox').nth(1).selectOption('origins-viktor');
  await page.getByRole('button', { name: 'Enter the Rift' }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'End turn', exact: true }).click();
    await settleMatch(page);
    await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
  }
  const champion = page.getByRole('button', { name: /Select chosen champion/ });
  const from = (await champion.boundingBox())!, to = (await page.locator('.your-base').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await expect(page.locator('.drag-card-ghost')).toBeVisible();
  await expect(page.locator('.your-base')).toHaveClass(/drop-hover/);
  await page.screenshot({ path: '.runtime/browser-test/drag.png', fullPage: true });
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(champion).toBeVisible();
  await expect(page.locator('.your-base .table-unit')).toHaveCount(0);
  await expect(page.locator('.drag-card-ghost')).toHaveCount(0);
  await page.keyboard.down('Shift');
  await champion.dragTo(page.locator('.your-base'));
  await page.keyboard.up('Shift');
  await expect(page.locator('.your-base .unit-status')).toContainText('Ready');
  await expect(page.locator('.your-base .table-unit')).toHaveCount(1);
});

test.describe('Touch input', () => {
  test.use({ hasTouch: true });
  test('Chrome: a touch drag plays the chosen champion', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Enter the Rift' })).toBeEnabled();
    await page.getByRole('combobox').first().selectOption('proving-grounds-lux');
    await page.getByRole('button', { name: 'Enter the Rift' }).click();
    await page.getByRole('button', { name: 'End turn', exact: true }).click();
    await settleMatch(page);
    await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
    const champion = page.getByRole('button', { name: /Select chosen champion/ });
    await champion.scrollIntoViewIfNeeded();
    const from = (await champion.boundingBox())!, to = (await page.locator('.your-base').boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - 20 }] });
    await expect(page.locator('.drag-card-ghost')).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.your-base .table-unit')).toHaveCount(1);
    await expect(champion).toHaveCount(0);
    await expect(page.locator('.drag-card-ghost')).toHaveCount(0);
    await cdp.detach();
  });
});
