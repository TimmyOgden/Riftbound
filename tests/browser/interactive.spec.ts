import { test, expect } from '@playwright/test';
test('Chrome: interactive ability chain, cost guidance and practice reload recovery', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter the Rift' })).toBeEnabled();
  await page.getByRole('combobox').first().selectOption('origins-viktor');
  await expect(page.getByLabel('Interactive rules')).toHaveCount(0); await page.getByLabel('Guide my first match').check();
  await page.getByRole('button', { name: 'Enter the Rift' }).click();
  await page.getByRole('button', { name: /Take your seat/ }).click();
  await expect(page.getByRole('region', { name: 'Match guide' })).toBeVisible();
  await page.getByRole('button', { name: /Select chosen champion/ }).click();
  await expect(page.locator('.cost-feedback')).toContainText('matching power');
  await page.getByRole('button', { name: 'Create Recruit · 1 energy' }).click();
  await expect(page.getByRole('region', { name: 'Response window' })).toContainText('Herald of the Arcane');
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeDisabled();
  await page.screenshot({ path: '.runtime/browser-test/interactive-chain.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Response window' })).toContainText('Herald of the Arcane');
  await page.getByRole('button', { name: 'Pass priority' }).click();
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
  await expect(page.locator('.your-base .table-unit')).toHaveCount(1);
  await expect(page.locator('.ability-legend')).toContainText('Exhausted');
  await page.reload(); await expect(page.locator('.your-base .table-unit')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});
test('Chrome: two friends start a private duel, exchange turns and restore their own table after refresh', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext({ reducedMotion: 'reduce' }), browser.newContext({ reducedMotion: 'reduce' })]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = []; pages.forEach(p => p.on('pageerror', e => errors.push(e.message)));
  try {
    for (const [i, page] of pages.entries()) {
      await page.goto('/'); await expect(page.getByRole('button', { name: 'Enter the Rift' })).toBeEnabled();
      await page.getByRole('button', { name: 'With friends' }).click();
      await page.getByLabel('Your nickname').fill(i ? 'Guest' : 'Host'); await page.getByLabel('Room password').fill('browser-friends');
    }
    await pages[0].getByRole('button', { name: /Create room/ }).click();
    const code = await pages[0].locator('.room-code').textContent();
    await pages[1].getByLabel('Room code').fill(code!); await pages[1].getByRole('button', { name: 'Join room', exact: true }).click();
    for (const page of pages) { await page.getByLabel('Friend match deck').selectOption('proving-grounds-lux'); await page.getByRole('button', { name: 'Toggle ready' }).click(); }
    await pages[0].getByRole('button', { name: 'Start friend match' }).click();
    for (const page of pages) { await expect(page.locator('.friends-page .match-shell')).toBeVisible(); await expect(page.locator('.friends-page .hidden-hand img')).toHaveCount(0); }
    const turn = async () => { for (const [i, page] of pages.entries()) if (await page.getByRole('button', { name: 'End turn', exact: true }).isEnabled()) return i; throw Error('No player has the turn'); };
    const first = await turn(); await pages[first].getByRole('button', { name: 'End turn', exact: true }).click();
    await expect(pages[1-first].getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
    await pages[1-first].getByRole('button', { name: 'End turn', exact: true }).click();
    await expect(pages[first].getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
    await pages[first].getByRole('button', { name: /Select chosen champion/ }).click();
    await pages[first].getByRole('button', { name: /Play card/ }).click();
    await expect(pages[first].locator('.friends-page .your-base .table-unit')).toHaveCount(1);
    await expect(pages[1-first].locator('.friends-page .opponent-base .table-unit')).toHaveCount(1);
    await pages[first].reload(); await pages[first].getByRole('button', { name: 'With friends' }).click();
    await expect(pages[first].locator('.friends-page .your-base .table-unit')).toHaveCount(1);
    await expect(pages[first].getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
    await pages[first].screenshot({ path: '.runtime/browser-test/friend-match.png', fullPage: true });
    // Deploy both champions, then contest the same field to exercise manual damage.
    await pages[first].getByRole('button', { name: 'End turn', exact: true }).click();
    await expect(pages[1-first].getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
    await pages[1-first].getByRole('button', { name: /Select chosen champion/ }).click();
    await pages[1-first].getByRole('button', { name: /Play card/ }).click();
    await pages[1-first].getByRole('button', { name: 'End turn', exact: true }).click();
    await expect(pages[first].getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
    await pages[first].locator('.friends-page .your-base .table-unit').click();
    await pages[first].locator('.friends-page .field-zone').first().getByRole('button', { name: /Move here/ }).click();
    await pages[first].getByRole('button', { name: 'Pass priority' }).click();
    await expect(pages[1-first].getByRole('button', { name: 'Pass priority' })).toBeEnabled();
    await pages[1-first].getByRole('button', { name: 'Pass priority' }).click();
    await expect(pages[first].getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
    await pages[first].getByRole('button', { name: 'End turn', exact: true }).click();
    await expect(pages[1-first].getByRole('button', { name: 'End turn', exact: true })).toBeEnabled();
    await pages[1-first].locator('.friends-page .your-base .table-unit').click();
    await pages[1-first].locator('.friends-page .field-zone').first().getByRole('button', { name: /Move here/ }).click();
    await pages[1-first].getByRole('button', { name: 'Pass priority' }).click();
    await expect(pages[first].getByRole('button', { name: 'Pass priority' })).toBeEnabled();
    await pages[first].getByRole('button', { name: 'Pass priority' }).click();
    await expect(pages[1-first].getByRole('button', { name: 'Confirm damage order' })).toBeEnabled();
    await pages[1-first].screenshot({ path: '.runtime/browser-test/combat-assignment.png', fullPage: true });
    await pages[1-first].getByRole('button', { name: 'Confirm damage order' }).click();
    await expect(pages[first].getByRole('button', { name: 'Confirm damage order' })).toBeEnabled();
    await pages[first].getByRole('button', { name: 'Confirm damage order' }).click();
    await expect(pages[first].locator('.friends-page .field-zone .table-unit')).toHaveCount(0);
    await expect(pages[1-first].locator('.friends-page .field-zone .table-unit')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
