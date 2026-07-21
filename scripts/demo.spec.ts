import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const baseUrl = process.env.DEMO_BASE_URL
if (!baseUrl) throw new Error('Set DEMO_BASE_URL to the healthy local application URL.')

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: 'on', size: { width: 1280, height: 720 } },
})

test('Neutro deterministic adaptation walkthrough', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /shape the interface/i })).toBeVisible()
  await page.waitForTimeout(12_000)

  await page.getByRole('link', { name: /open adaptation studio/i }).click()
  await expect(page.getByRole('heading', { name: 'Adaptation studio' })).toBeVisible()
  await page.screenshot({ path: path.join(repositoryRoot, 'docs/demo/demo-thumbnail.png') })
  await page.waitForTimeout(12_000)

  await page.getByRole('button', { name: /reading focus/i }).click()
  await page.waitForTimeout(18_000)

  await page.getByRole('button', { name: /low stimulation/i }).click()
  await expect(page.locator('html')).toHaveAttribute('data-adapt-sensory', 'low')
  await page.waitForTimeout(18_000)

  await page.getByLabel('Typeface').selectOption('mono')
  await page.getByLabel('Text size').evaluate((element: HTMLInputElement) => {
    element.value = '1.2'
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(12_000)

  await page.getByLabel('Contrast').selectOption('high')
  await page.getByLabel('Sensory load').selectOption('standard')
  await page.waitForTimeout(12_000)

  await page.getByLabel('Simplified layout').uncheck()
  await page.getByLabel('Focus assistance').check()
  await page.getByText('Current focus').locator('..').focus()
  await page.waitForTimeout(14_000)

  await page.getByRole('heading', { name: 'Why the interface changed' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(16_000)

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByText('Active profile:').locator('span')).toHaveText('custom')
  await page.waitForTimeout(15_000)

  await page.getByRole('button', { name: 'Reset to balanced' }).click()
  await expect(page.getByText('Active profile:').locator('span')).toHaveText('balanced')
  await page.waitForTimeout(14_000)

  await page.getByRole('link', { name: 'Reading' }).click()
  await expect(page.getByRole('heading', { name: /reading/i }).first()).toBeVisible()
  await page.waitForTimeout(12_000)

  await page.getByRole('link', { name: 'Local labs' }).click()
  await expect(page.getByRole('heading', { name: 'Local Replay Lab' })).toBeVisible()
  await page.waitForTimeout(12_000)

  await page.goto(`${baseUrl}/#/demo/mood-motion`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Experimental Camera Signal Lab' })).toBeVisible()
  await page.waitForTimeout(12_000)

  await page.getByRole('link', { name: 'Home' }).click()
  await page.waitForTimeout(25_000)
})
