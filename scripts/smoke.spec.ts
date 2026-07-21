import { expect, test } from '@playwright/test'

const baseUrl = process.env.DEMO_BASE_URL
if (!baseUrl) throw new Error('Set DEMO_BASE_URL to the healthy local application URL.')

test('primary adaptation workflow persists, explains, and resets', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /shape the interface/i })).toBeVisible()

  await page.getByRole('link', { name: /open adaptation studio/i }).click()
  await expect(page.getByRole('heading', { name: 'Adaptation studio' })).toBeVisible()

  await page.getByRole('button', { name: /low stimulation/i }).click()
  await expect(page.locator('html')).toHaveAttribute('data-adapt-sensory', 'low')
  await expect(page.locator('html')).toHaveAttribute('data-adapt-motion', 'reduced')
  await expect(page.getByText('Active profile:').locator('span')).toHaveText('low stimulation')
  await expect(page.getByRole('listitem').filter({ hasText: /low sensory load removes/i })).toBeVisible()

  await page.getByLabel('Contrast').selectOption('high')
  await expect(page.locator('html')).toHaveAttribute('data-adapt-contrast', 'high')
  await expect(page.getByText('Active profile:').locator('span')).toHaveText('custom')

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-adapt-contrast', 'high')
  await expect(page.getByText('Active profile:').locator('span')).toHaveText('custom')

  await page.getByRole('button', { name: 'Reset to balanced' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-adapt-contrast', 'standard')
  await expect(page.locator('html')).toHaveAttribute('data-adapt-sensory', 'standard')
  await expect(page.getByText('Active profile:').locator('span')).toHaveText('balanced')
})

test('mobile adaptation route has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/#/adapt`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Adaptation studio' })).toBeVisible()

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth)

  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()
})
