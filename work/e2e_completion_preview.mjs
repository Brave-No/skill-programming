import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const baseUrl = 'http://127.0.0.1:5174/?celebration=preview'
const outputs = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'outputs')

const assertNoOverflow = async (page, label) => {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
  assert.ok(metrics.scrollWidth <= metrics.innerWidth, `${label}: document overflow ${JSON.stringify(metrics)}`)
  assert.ok(metrics.bodyScrollWidth <= metrics.innerWidth, `${label}: body overflow ${JSON.stringify(metrics)}`)
}

const browser = await chromium.launch({ headless: true })
const errors = []

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
desktop.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console:${message.text()}`)
})
desktop.on('pageerror', (error) => errors.push(`pageerror:${error.message}`))
await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
assert.equal(await desktop.getByRole('dialog').isVisible(), true)
assert.equal(await desktop.locator('.sp-journey__stage').count(), 6)
await assertNoOverflow(desktop, 'desktop-opening')
await desktop.waitForTimeout(1450)
await desktop.screenshot({ path: resolve(outputs, 'generic-completion-core-desktop.png') })
await desktop.waitForTimeout(1900)
assert.equal(await desktop.getByRole('heading', { name: '关卡通关' }).isVisible(), true)
assert.match(await desktop.locator('.sp-verification').innerText(), /12 \/ 12/)
await desktop.screenshot({ path: resolve(outputs, 'generic-completion-final-desktop.png') })

await desktop.getByRole('button', { name: '重播通关动画' }).click()
await desktop.waitForTimeout(1450)
await desktop.screenshot({ path: resolve(outputs, 'generic-completion-replay-desktop.png') })
await desktop.waitForTimeout(1900)
await desktop.getByRole('button', { name: '查看通关结果' }).click()
assert.equal(await desktop.getByRole('dialog').count(), 0)
assert.equal(await desktop.getByRole('heading', { name: '技能编程', exact: true }).isVisible(), true)

await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
await desktop.keyboard.press('Escape')
assert.equal(await desktop.getByRole('dialog').count(), 0)
await desktop.close()

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(3350)
assert.equal(await mobile.getByRole('heading', { name: '关卡通关' }).isVisible(), true)
await assertNoOverflow(mobile, 'mobile-final')
await mobile.screenshot({ path: resolve(outputs, 'generic-completion-final-mobile.png') })
await mobile.close()

const reduced = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
})
await reduced.goto(baseUrl, { waitUntil: 'networkidle' })
assert.equal(await reduced.getByRole('heading', { name: '关卡通关' }).isVisible(), true)
await assertNoOverflow(reduced, 'mobile-reduced-motion')
await reduced.close()

assert.deepEqual(errors, [])
await browser.close()

console.log('GENERIC_COMPLETION_PREVIEW_PASS desktop mobile replay close escape reduced-motion')
