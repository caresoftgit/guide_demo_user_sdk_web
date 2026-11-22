import { expect, test, type Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Kết nối Voice', exact: true }).click();
  await expect(page.locator('#user')).toHaveText('Khách hàng 42');
  await page.getByRole('button', { name: 'Bật âm thanh', exact: true }).click();
  await expect(page.getByRole('button', { name: /Gọi CSKH/ })).toBeEnabled();
}
test('customer home, call mute/unmute, DTMF, remote end and return to home', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await login(page);
  await page.getByRole('button', { name: /Gọi CSKH/ }).click();
  const view = page.locator('caresoft-voice-call'); await expect(view.getByText('Đang đàm thoại', { exact: true })).toBeVisible();
  await view.getByRole('button', { name: 'Tắt mic', exact: true }).click(); await expect(view.getByRole('button', { name: 'Bật mic', exact: true })).toBeEnabled();
  await view.getByRole('button', { name: 'Bật mic', exact: true }).click(); await expect(view.getByRole('button', { name: 'Tắt mic', exact: true })).toBeEnabled();
  await view.getByRole('button', { name: 'Bàn phím', exact: true }).click(); await view.getByRole('button', { name: 'Gửi phím 5', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Gửi phím 6', exact: true })).toBeVisible(); await view.getByRole('button', { name: 'Gửi phím 6', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('active-call.png'), fullPage: true });
  await view.getByRole('button', { name: 'Kết thúc', exact: true }).click(); await expect(view.locator('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /Gọi CSKH/ })).toBeEnabled();
  expect(errors).toEqual([]);
});
test('incoming reject and answer with SDK call screen', async ({ page }) => {
  await login(page); await page.locator('#incoming').click(); const view = page.locator('caresoft-voice-call');
  await expect(view.getByRole('button', { name: 'Trả lời', exact: true })).toBeVisible();
  await view.getByRole('button', { name: 'Từ chối', exact: true }).click(); await expect(view.locator('dialog')).not.toBeVisible();
  await page.locator('#incoming').click(); await view.getByRole('button', { name: 'Trả lời', exact: true }).click();
  await expect(view.getByText('Đang đàm thoại', { exact: true })).toBeVisible();
  // Native dialog blocks clicks behind it; trigger the simulated remote endpoint through the fixture control.
  await page.locator('#remote-end').evaluate((b: HTMLButtonElement) => b.click()); await expect(view.locator('dialog')).not.toBeVisible();
});
test('reconnect status, preserved mute and continuous 30 second timeout', async ({ page }) => {
  await page.clock.install(); await login(page); await page.getByRole('button', { name: /Gọi CSKH/ }).click(); const view = page.locator('caresoft-voice-call');
  await view.getByRole('button', { name: 'Tắt mic', exact: true }).click();
  await page.locator('#reconnect').evaluate((b: HTMLButtonElement) => b.click());
  await expect(view.getByText('Đang kết nối lại…', { exact: true })).toBeVisible(); await expect(view.getByRole('button', { name: 'Bật mic', exact: true })).toBeDisabled();
  await page.clock.fastForward(20000); await page.locator('#recovered').evaluate((b: HTMLButtonElement) => b.click());
  await expect(view.getByRole('button', { name: 'Bật mic', exact: true })).toBeEnabled();
  await page.locator('#reconnect').evaluate((b: HTMLButtonElement) => b.click()); await page.clock.fastForward(20000);
  await page.locator('#reconnect').evaluate((b: HTMLButtonElement) => b.click()); await page.clock.fastForward(11000);
  await expect(view.locator('dialog')).not.toBeVisible(); await expect(page.locator('#app #error')).toContainText('30 giây');
});
test('disconnect clears only the Voice session and reconnect uses the existing application session', async ({ page }) => {
  await login(page); await page.locator('#logout').click(); await page.locator('#confirm-logout').click();
  await expect(page.locator('#user')).toHaveText('Chưa kết nối Voice');
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
  await page.locator('#login').click(); await expect(page.locator('#user')).toHaveText('Khách hàng 42');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
test('revoked session closes call and requires login', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: /Gọi CSKH/ }).click(); const view = page.locator('caresoft-voice-call');
  await expect(view.getByText('Đang đàm thoại', { exact: true })).toBeVisible(); await page.locator('#revoke').evaluate((b: HTMLButtonElement) => b.click());
  await expect(view.locator('dialog')).not.toBeVisible(); await expect(page.locator('#user')).toHaveText('Chưa kết nối Voice');
});

test('shows offline/reconnecting status, prevents new calls and retains login', async ({ page, context }, testInfo) => {
  await login(page); await context.setOffline(true);
  await expect(page.locator('#app #status')).toContainText('Mất kết nối mạng'); await page.screenshot({ path: testInfo.outputPath('offline.png'), fullPage: true });
  await expect(page.locator('#user')).toHaveText('Khách hàng 42'); await expect(page.getByRole('button', { name: /Gọi CSKH/ })).toBeDisabled();
  await context.setOffline(false); await expect(page.locator('#app #status')).toHaveText('Sẵn sàng gọi và nhận cuộc gọi');
});
test('restores and checks login after reload, clears it on logout and never saves the account token', async ({ page }, testInfo) => {
  await login(page); await page.reload(); await expect(page.locator('#user')).toHaveText('Khách hàng 42');
  await expect(page.locator('#login')).not.toBeVisible(); await expect(page.locator('#reasons')).toContainText('Bấm Bật âm thanh'); await page.screenshot({ path: testInfo.outputPath('restored.png'), fullPage: true });
  const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.values(sessionStorage).join('') }));
  expect(storage.local).toEqual([]); expect(storage.session).not.toContain('enterprise_access_token');
  await page.getByRole('button', { name: 'Bật âm thanh', exact: true }).click(); await expect(page.getByRole('button', { name: /Gọi CSKH/ })).toBeEnabled();
  await page.locator('#logout').click(); await page.locator('#confirm-logout').click(); await page.reload();
  await expect(page.locator('#user')).toHaveText('Chưa kết nối Voice');
});
test('warns on reload during a call and cancellation keeps it', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: /Gọi CSKH/ }).click(); const view = page.locator('caresoft-voice-call');
  await expect(view.getByText('Đang đàm thoại', { exact: true })).toBeVisible();
  const warning = page.waitForEvent('dialog'); await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
  const dialog = await warning; expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss();
  await expect(view.getByText('Đang đàm thoại', { exact: true })).toBeVisible();
  await view.getByRole('button', { name: 'Tắt mic', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Bật mic', exact: true })).toBeEnabled();
});
test('confirmed reload ends the call while keeping login', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: /Gọi CSKH/ }).click(); const view = page.locator('caresoft-voice-call');
  await expect(view.getByText('Đang đàm thoại', { exact: true })).toBeVisible();
  const confirmation = page.waitForEvent('dialog'); const confirmed = page.waitForEvent('load');
  await page.evaluate(() => { setTimeout(() => location.reload(), 0); }); const dialog = await confirmation;
  expect(dialog.type()).toBe('beforeunload'); await dialog.accept(); await confirmed;
  await expect(page.locator('#user')).toHaveText('Khách hàng 42'); await expect(view.locator('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Bật âm thanh', exact: true }).click(); await expect(page.getByRole('button', { name: /Gọi CSKH/ })).toBeEnabled();
});
test('does not enable account/audio controls until the restored session has been checked', async ({ page }) => {
  await login(page); await page.goto('/?restoreDelay=1200');
  await expect(page.locator('#user')).toHaveText('Khách hàng 42');
  await expect(page.locator('#app #status')).toHaveText('Đang kiểm tra phiên đăng nhập…');
  await expect(page.locator('#prepare')).toBeDisabled(); await expect(page.locator('#logout')).toBeDisabled();
  await page.locator('#prepare').click(); await expect(page.getByRole('button', { name: /Gọi CSKH/ })).toBeEnabled();
});
test('copied session in another tab cannot take over the original session', async ({ page }) => {
  await login(page); const popup = page.waitForEvent('popup'); await page.evaluate(() => window.open('/', '_blank'));
  const other = await popup; await expect(other.locator('#user')).toHaveText('Chưa kết nối Voice');
  await expect(page.locator('#user')).toHaveText('Khách hàng 42'); await expect(page.locator('#app #status')).toHaveText('Sẵn sàng gọi và nhận cuộc gọi'); await other.close();
});

test('shows control-stream reconnect while preserving an established media call', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: /Gọi CSKH/ }).click(); const view = page.locator('caresoft-voice-call');
  await expect(view.getByText('Đang đàm thoại', { exact: true })).toBeVisible();
  await page.locator('#control-down').evaluate((button: HTMLButtonElement) => button.click());
  await expect(view.getByText('Đang kết nối lại dịch vụ cuộc gọi…', { exact: true })).toBeVisible();
  await expect(view.getByRole('button', { name: 'Kết thúc', exact: true })).toBeEnabled();
  await page.locator('#control-up').evaluate((button: HTMLButtonElement) => button.click());
  await expect(view.getByText('Đang đàm thoại', { exact: true })).toBeVisible();
  await view.getByRole('button', { name: 'Kết thúc', exact: true }).click();
});
