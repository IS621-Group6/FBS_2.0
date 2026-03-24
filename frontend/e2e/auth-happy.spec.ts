import { expect, test } from '@playwright/test'

test('user can sign in and reach search page', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Email').fill('test@test.com')
  await page.getByLabel(/^Password$/i).fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/(search)?$/)
  await expect(page.getByRole('main', { name: 'Results' })).toBeVisible()
})
