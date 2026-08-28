import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const baseUrl = 'http://127.0.0.1:5174/?hint=preview'
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

const openHint = async (page) => {
  const button = page.getByRole('button', { name: '下一步提示' })
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click()
}

const browser = await chromium.launch({ headless: true })
const errors = []

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
desktop.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console:${message.text()}`)
})
desktop.on('pageerror', (error) => errors.push(`pageerror:${error.message}`))
await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
await assertNoOverflow(desktop, 'desktop-empty')

await openHint(desktop)
assert.equal(await desktop.getByText('先建立遍历范围').isVisible(), true)
assert.equal(await desktop.locator('.rule-hint-node').count(), 0, 'hint must not alter the program')
assert.equal(await desktop.getByRole('button', { name: /遍历数据，加入规则/ }).getAttribute('disabled'), null)
assert.equal(await desktop.locator('.rule-hint-skill.is-recommended').innerText().then((text) => text.includes('遍历数据')), true)
assert.equal(await desktop.locator('.rule-hint-drop.is-recommended').isVisible(), true)

await desktop.getByRole('button', { name: /遍历数据，加入规则/ }).click()
assert.equal(await desktop.getByText('在遍历里加入判断').isVisible(), true)
assert.equal(await desktop.locator('.rule-hint-node').count(), 1)
assert.match(await desktop.locator('.rule-hint-skill.is-recommended').innerText(), /判断条件/)

await desktop.getByRole('button', { name: /判断条件，加入规则/ }).click()
assert.equal(await desktop.getByText('补上条件成立后的动作').isVisible(), true)
assert.equal(await desktop.locator('.rule-hint-node').count(), 2)
assert.match(await desktop.locator('.rule-hint-skill.is-recommended').innerText(), /执行动作/)

await desktop.getByRole('button', { name: /执行动作，加入规则/ }).click()
assert.equal(await desktop.getByText('运行当前批次', { exact: false }).first().isVisible(), true)
assert.equal(await desktop.locator('.rule-hint-node').count(), 3)
assert.equal(await desktop.locator('.rule-hint-runbar button.is-recommended').isVisible(), true)
await desktop.waitForTimeout(250)
await desktop.screenshot({ path: resolve(outputs, 'rule-hint-preview-desktop.png'), fullPage: true })

await desktop.getByRole('button', { name: '运行当前批次' }).click()
assert.equal(await desktop.getByText('当前批次通过').isVisible(), true)
assert.equal(await desktop.getByText('当前批次已验证').isVisible(), true)

await desktop.getByRole('button', { name: '关闭下一步提示' }).click()
assert.equal(await desktop.locator('#rule-hint-advice').count(), 0)
await desktop.getByRole('button', { name: '清空程序' }).click()
assert.equal(await desktop.locator('.rule-hint-node').count(), 0)
await desktop.close()

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
mobile.on('console', (message) => {
  if (message.type() === 'error') errors.push(`mobile-console:${message.text()}`)
})
mobile.on('pageerror', (error) => errors.push(`mobile-pageerror:${error.message}`))
await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
assert.equal(await mobile.getByRole('button', { name: '规则编排' }).getAttribute('class').then((value) => value?.includes('is-active')), true)
await openHint(mobile)
await mobile.getByRole('button', { name: /遍历数据，加入规则/ }).click()
await mobile.getByRole('button', { name: /判断条件，加入规则/ }).click()
await mobile.getByRole('button', { name: /执行动作，加入规则/ }).click()
await assertNoOverflow(mobile, 'mobile-program')
await mobile.screenshot({ path: resolve(outputs, 'rule-hint-preview-mobile.png'), fullPage: true })
await mobile.getByRole('button', { name: '数据场景' }).click()
assert.equal(await mobile.getByRole('heading', { name: '数据场景' }).isVisible(), true)
await assertNoOverflow(mobile, 'mobile-scene')
await mobile.close()

const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
await reduced.goto(baseUrl, { waitUntil: 'networkidle' })
await openHint(reduced)
assert.equal(await reduced.getByText('先建立遍历范围').isVisible(), true)
const reducedAnimationDuration = await reduced.locator('.rule-hint-skill.is-recommended').evaluate((element) => (
  Number.parseFloat(getComputedStyle(element).animationDuration)
))
assert.ok(reducedAnimationDuration <= 0.001, `reduced motion duration ${reducedAnimationDuration}s`)
await assertNoOverflow(reduced, 'mobile-reduced-motion')
await reduced.close()

assert.deepEqual(errors, [])
await browser.close()

console.log('RULE_HINT_PREVIEW_PASS empty loop condition action run close reset desktop mobile reduced-motion')
