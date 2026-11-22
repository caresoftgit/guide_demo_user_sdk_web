import {expect,test} from '@playwright/test';
test('connect uses existing enterprise session without collecting identity or password',async({page})=>{
 await page.goto('/');
 await expect(page.locator('input[type="password"], #user-input, #token-input')).toHaveCount(0);
 await page.getByRole('button',{name:'Kết nối Voice',exact:true}).click();
 await expect(page.locator('#user')).toHaveText('Khách hàng 42');
 await page.getByRole('button',{name:'Bật âm thanh',exact:true}).click();
 await expect(page.locator('#call')).toBeEnabled();
});
test('expired enterprise session requires the application to authenticate without a demo login form',async({page})=>{
 await page.goto('/?hostSession=expired');
 await page.getByRole('button',{name:'Kết nối Voice',exact:true}).click();
 await expect(page.locator('#app #error')).toContainText('Đăng nhập ứng dụng doanh nghiệp');
 await expect(page.locator('#user')).toHaveText('Chưa kết nối Voice');
 await expect(page.locator('input[type="password"]')).toHaveCount(0);
 await expect(page.locator('#call')).toBeDisabled();
});
