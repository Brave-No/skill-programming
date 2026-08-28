import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5182'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const coreSkills = [
  '建立起点档案',
  '逐项巡查',
  '更新累计刻度',
  '统计目标区间',
  '登记当前刻度',
]

const assertNoOverflow = async (page, label) => {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  assert.ok(metrics.documentWidth <= metrics.innerWidth, `${label}: ${JSON.stringify(metrics)}`)
  assert.ok(metrics.bodyWidth <= metrics.innerWidth, `${label}: ${JSON.stringify(metrics)}`)
}

const completeManual = async (page) => {
  await page.getByRole('button', { name: '0 号站，数值 1' }).click()
  await page.getByRole('button', { name: '1 号站，数值 1' }).click()
  await page.getByRole('button', { name: '1 号站，数值 1' }).click()
  await page.getByRole('button', { name: '2 号站，数值 1' }).click()
  await page.getByText('两个目标区间都已找到，可以进入档案技能台。', { exact: true }).waitFor()
  await page.getByRole('button', { name: '进入档案技能台' }).click()
}

const placeSkill = async (page, label, position) => {
  await page.getByRole('button', { name: `选择技能：${label}` }).click()
  await page.getByRole('button', { name: position, exact: true }).click()
}

const assembleCorrectProgram = async (page) => {
  await placeSkill(page, '建立起点档案', '主流程第 1 个放置位置')
  await placeSkill(page, '逐项巡查', '主流程第 2 个放置位置')
  await placeSkill(page, '更新累计刻度', '逐项巡查第 1 个放置位置')
  await placeSkill(page, '统计目标区间', '逐项巡查第 2 个放置位置')
  await placeSkill(page, '登记当前刻度', '逐项巡查第 3 个放置位置')
}

const fillStructuredSolution = async (page) => {
  const lines = [
    ['起点档案第 1 行', 'Map<Integer, Integer> frequency = new HashMap<>()'],
    ['起点档案第 2 行', 'frequency.put(0, 1)'],
    ['巡查状态第 1 行', 'int index = 0'],
    ['巡查状态第 2 行', 'int prefixSum = 0'],
    ['巡查状态第 3 行', 'int needed = 0'],
    ['巡查状态第 4 行', 'int count = 0'],
    ['巡查条件', 'index < nums.length'],
    ['累计刻度第 1 行', 'prefixSum += nums[index]'],
    ['目标旧刻度第 1 行', 'needed = prefixSum - k'],
    ['累加命中第 1 行', 'count += frequency.getOrDefault(needed, 0)'],
    ['登记当前刻度第 1 行', 'frequency.put(prefixSum, frequency.getOrDefault(prefixSum, 0) + 1)'],
    ['探针前进第 1 行', 'index++'],
    ['返回结果第 1 行', 'return count'],
  ]
  for (const [label, value] of lines) await page.getByRole('textbox', { name: label, exact: true }).fill(value)
}

const browser = await chromium.launch({ headless: true })
const errors = []

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
desktop.on('console', (message) => { if (message.type() === 'error') errors.push(`desktop:${message.text()}`) })
desktop.on('pageerror', (error) => errors.push(`desktop:${error.message}`))
await desktop.goto(`${baseUrl}/games/subarray-sum-k/`, { waitUntil: 'networkidle' })
await desktop.getByRole('heading', { name: '找出连续区间' }).waitFor()
await assertNoOverflow(desktop, 'desktop manual')

await desktop.getByRole('button', { name: '0 号站，数值 1' }).click()
await desktop.getByRole('button', { name: '2 号站，数值 1' }).click()
await desktop.getByText('0 到 2 号站的总和是 3，还不是目标 2。', { exact: true }).waitFor()
await completeManual(desktop)
assert.equal(await desktop.locator('[data-program-node]').count(), 0)
assert.equal(await desktop.getByRole('button', { name: '校验全部批次' }).isDisabled(), true)
assert.equal(await desktop.locator('.skill-shelf .shelf-skill').count(), 5)

for (const skill of coreSkills) {
  await desktop.getByRole('button', { name: `预演技能：${skill}` }).click()
  await desktop.getByRole('dialog').waitFor()
  assert.equal(await desktop.locator('[data-program-node]').count(), 0)
  await desktop.getByRole('button', { name: '关闭技能预演' }).click()
}

const dragSource = desktop.getByRole('button', { name: '取用技能：登记当前刻度' })
const dragTarget = desktop.getByRole('button', { name: '主流程第 1 个放置位置' })
await dragSource.scrollIntoViewIfNeeded()
const sourceBox = await dragSource.boundingBox()
const targetBox = await dragTarget.boundingBox()
assert.ok(sourceBox && targetBox)
await desktop.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
await desktop.mouse.down()
await desktop.mouse.move(sourceBox.x + 20, sourceBox.y + 20, { steps: 4 })
await desktop.locator('.drag-overlay').waitFor({ state: 'visible' })
await desktop.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
await desktop.waitForTimeout(250)
await desktop.mouse.up()
await desktop.locator('.drag-overlay').waitFor({ state: 'hidden' })
assert.equal(await desktop.locator('[data-program-node]').count(), 1)
await desktop.getByRole('button', { name: '删除技能：登记当前刻度' }).click()

await placeSkill(desktop, '建立起点档案', '主流程第 1 个放置位置')
await placeSkill(desktop, '逐项巡查', '主流程第 2 个放置位置')
await desktop.getByRole('button', { name: '校验全部批次' }).click()
await desktop.getByText('3 个批次未通过', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '查看第 1 批' }).click()
await desktop.getByText('逐项巡查里面还没有放入处理当前站的技能。', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '重置执行' }).click()

await placeSkill(desktop, '更新累计刻度', '逐项巡查第 1 个放置位置')
await placeSkill(desktop, '统计目标区间', '逐项巡查第 2 个放置位置')
await placeSkill(desktop, '登记当前刻度', '逐项巡查第 3 个放置位置')
assert.equal(await desktop.locator('[data-program-node]').count(), 5)

await desktop.getByRole('button', { name: '运行当前批次' }).click()
const frameMessages = []
for (let sample = 0; sample < 150; sample += 1) {
  const message = await desktop.locator('.archive-frame-message span').innerText()
  if (frameMessages.at(-1) !== message) frameMessages.push(message)
  if (await desktop.locator('.archive-frame-message.status-success').count() > 0) break
  await desktop.waitForTimeout(100)
}
const frameTrace = frameMessages.join('\n')
assert.match(frameTrace, /读取当前变化/)
assert.match(frameTrace, /目标旧刻度/)
assert.match(frameTrace, /份历史档案；命中计数/)
assert.match(frameTrace, /登记发生在查询之后/)
assert.match(frameTrace, /探针从 0 号站前进到 1 号站/)
await desktop.getByRole('button', { name: '重置执行' }).click()

await desktop.getByRole('button', { name: '校验全部批次' }).click()
await desktop.getByText('全部批次通过', { exact: true }).waitFor()
await desktop.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await desktop.screenshot({ path: resolve(root, 'public/previews/subarray-sum-k.png'), fullPage: false })
await assertNoOverflow(desktop, 'desktop program')

const codeButton = desktop.getByRole('button', { name: '进入代码实战' })
assert.equal(await codeButton.isEnabled(), true)
await codeButton.click()
await desktop.getByRole('heading', { name: '把前缀档案规则写成代码' }).waitFor()
assert.equal(await desktop.getByText('固定作用域已锁定，待填写 9 项语义', { exact: true }).isVisible(), true)
await desktop.getByRole('button', { name: '运行当前用例' }).click()
const firstSlot = desktop.getByRole('textbox', { name: '起点档案第 1 行' })
await firstSlot.waitFor()
assert.equal(await firstSlot.evaluate((element) => document.activeElement === element), true)
await fillStructuredSolution(desktop)
await desktop.getByRole('button', { name: '运行当前用例' }).click()
await desktop.getByText('当前用例通过', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '提交全部用例' }).click()
await desktop.getByRole('dialog').waitFor()
assert.match(await desktop.locator('.sp-verification').innerText(), /9 \/ 9/)
await desktop.getByRole('button', { name: '查看通关结果' }).click()
await desktop.getByText('全部公开与隐藏用例通过', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '提交全部用例' }).click()
assert.equal(await desktop.getByRole('dialog').count(), 0)
await desktop.reload({ waitUntil: 'networkidle' })
assert.equal(await desktop.getByRole('dialog').count(), 0)
await assertNoOverflow(desktop, 'desktop code reload')

const catalog = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await catalog.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
const catalogCard = catalog.locator('[data-challenge-id="subarray-sum-k"]')
await catalogCard.waitFor()
assert.equal(await catalogCard.getByText('已开放', { exact: true }).isVisible(), true)
assert.equal(await catalogCard.locator('img').getAttribute('src'), '/previews/subarray-sum-k.png')
await assertNoOverflow(catalog, 'desktop catalog')
await catalog.close()

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
mobile.on('console', (message) => { if (message.type() === 'error') errors.push(`mobile:${message.text()}`) })
mobile.on('pageerror', (error) => errors.push(`mobile:${error.message}`))
await mobile.goto(`${baseUrl}/games/subarray-sum-k/`, { waitUntil: 'networkidle' })
await completeManual(mobile)
await assembleCorrectProgram(mobile)
await mobile.getByRole('button', { name: '校验全部批次' }).tap()
await mobile.getByText('全部批次通过', { exact: true }).waitFor()
await assertNoOverflow(mobile, 'mobile program')
await mobile.screenshot({ path: resolve(root, 'outputs/subarray-sum-k-program-mobile.png'), fullPage: true })
await mobile.evaluate(() => localStorage.removeItem('skill-programming:subarray-sum-k:completion:v1'))
await mobile.getByRole('button', { name: '进入代码实战' }).tap()
await mobile.getByRole('button', { name: '编辑' }).tap()
await assertNoOverflow(mobile, 'mobile code')
await fillStructuredSolution(mobile)
await mobile.getByRole('button', { name: '提交全部用例' }).tap()
await mobile.getByRole('dialog').waitFor()
assert.match(await mobile.locator('.sp-verification').innerText(), /9 \/ 9/)
await assertNoOverflow(mobile, 'mobile completion')
await mobile.waitForTimeout(3500)
await mobile.screenshot({ path: resolve(root, 'outputs/subarray-sum-k-completion-mobile.png'), fullPage: false })
await mobile.getByRole('button', { name: '查看通关结果' }).tap()
await mobile.getByText('全部公开与隐藏用例通过', { exact: true }).waitFor()
await mobile.close()

assert.deepEqual(errors, [])
await browser.close()

console.log('SUBARRAY_SUM_K_E2E_PASS manual preview drag invalid repair batches code completion repeat reload catalog mobile')
