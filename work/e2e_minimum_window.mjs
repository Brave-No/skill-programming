import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5184'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const referenceBody = `int[] debt = new int[128];
int goal = 0;
while (t.length() > goal) {
  int wanted = t.charAt(goal);
  debt[wanted] += 1;
  goal += 1;
}
int lo = 0;
int hi = 0;
int open = t.length();
int answerAt = 0;
int answerSize = 1 + s.length();
while (s.length() > hi) {
  int enter = s.charAt(hi);
  if (0 < debt[enter]) {
    open -= 1;
  }
  debt[enter] -= 1;
  while (0 == open) {
    int size = hi - lo + 1;
    if (answerSize > size) {
      answerAt = lo;
      answerSize = size;
    }
    int leave = s.charAt(lo);
    debt[leave] += 1;
    if (0 < debt[leave]) {
      open += 1;
    }
    lo += 1;
  }
  hi += 1;
}
if (s.length() < answerSize) {
  return s.substring(0, 0);
}
return s.substring(answerAt, answerSize + answerAt);`

const assertNoOverflow = async (page, label) => {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  assert.ok(metrics.documentWidth <= metrics.innerWidth, `${label}: ${JSON.stringify(metrics)}`)
  assert.ok(metrics.bodyWidth <= metrics.innerWidth, `${label}: ${JSON.stringify(metrics)}`)
}

const attachErrorCapture = (page, errors, label) => {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label}:console:${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`${label}:page:${error.message}`))
}

const completeManual = async (page) => {
  await page.getByRole('button', { name: '9 号字符 B', exact: true }).click()
  await page.getByRole('button', { name: '12 号字符 C', exact: true }).click()
  await page.getByRole('button', { name: '校验窗口' }).click()
  await page.getByText('“BANC”覆盖全部目标字符，并且已经不能再缩短。', { exact: true }).waitFor()
  await page.getByRole('button', { name: '认识窗口技能' }).click()
}

const selectSkill = async (page, label) => {
  const card = page.locator('.mw-shelf-skill').filter({
    has: page.getByRole('button', { name: `查看技能：${label}`, exact: true }),
  })
  await card.locator('.mw-shelf-skill__pick').click()
}

const placeRoot = async (page, label, index) => {
  await selectSkill(page, label)
  await page.getByRole('button', { name: `主流程第 ${index + 1} 个放置位置`, exact: true }).click()
}

const programNode = (page, shortLabel) => page
  .getByText(shortLabel, { exact: true })
  .locator('xpath=ancestor::article[contains(@class, "mw-program-node")][1]')

const placeNested = async (page, label, parentShortLabel, index) => {
  await selectSkill(page, label)
  const scope = programNode(page, parentShortLabel).locator(':scope > .mw-program-scope')
  await scope.locator(':scope > button.mw-drop-slot').nth(index).click()
}

const assembleCorrectProgram = async (page) => {
  await placeRoot(page, '建立目标欠账', 0)
  await placeRoot(page, '向右扩张窗口', 1)
  await placeNested(page, '纳入右侧字符', '向右扩张', 0)
  await placeNested(page, '覆盖后持续收缩', '向右扩张', 1)
  await placeNested(page, '记录更短窗口', '覆盖后收缩', 0)
  await placeNested(page, '移出左侧字符', '覆盖后收缩', 1)
}

const verifyDesktopDragFromShelf = async (page) => {
  const card = page.locator('.mw-shelf-skill').filter({
    has: page.getByRole('button', { name: '查看技能：建立目标欠账', exact: true }),
  })
  const source = card.locator('.mw-shelf-skill__pick')
  const target = page.getByRole('button', { name: '主流程第 1 个放置位置', exact: true })
  await source.scrollIntoViewIfNeeded()
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  assert.ok(sourceBox && targetBox)
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + 18, sourceBox.y + 18, { steps: 4 })
  await page.locator('.mw-drag-overlay').waitFor({ state: 'visible' })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
  await page.waitForTimeout(240)
  await page.mouse.up()
  await page.locator('.mw-drag-overlay').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('[data-program-node]').count(), 1)
  await page.getByRole('button', { name: '移回技能架：建立目标欠账', exact: true }).click()
  assert.equal(await page.locator('[data-program-node]').count(), 0)
}

const reachProgramStage = async (page) => {
  await completeManual(page)
  const preview = page.locator('.mw-skill-overview button').filter({ hasText: '建立欠账' }).first()
  await preview.click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.locator('[data-program-node]').count(), 0)
  await page.getByRole('button', { name: '预演完成' }).click()
  await page.getByText('已查看 1 / 6 项技能', { exact: true }).waitFor()
  await page.getByRole('button', { name: '从空程序开始编排' }).click()
}

const runFirstBatchBySteps = async (page) => {
  const step = page.getByRole('button', { name: '单步', exact: true })
  for (let index = 0; index < 360; index += 1) {
    if (await page.getByText('当前批次通过', { exact: true }).count()) return
    await step.click()
  }
  throw new Error('第一批在 360 个执行帧内没有完成')
}

const fillStructuredSolution = async (page) => {
  const fields = [
    ['准备目标登记第 1 行', 'int[] need = new int[128]'],
    ['准备目标登记第 2 行', 'int targetIndex = 0'],
    ['目标登记条件', 'targetIndex < t.length()'],
    ['读取目标字符第 1 行', 'int targetChar = t.charAt(targetIndex)'],
    ['增加目标欠账第 1 行', 'need[targetChar]++'],
    ['目标索引前进第 1 行', 'targetIndex++'],
    ['准备窗口状态第 1 行', 'int left = 0'],
    ['准备窗口状态第 2 行', 'int right = 0'],
    ['准备窗口状态第 3 行', 'int missing = t.length()'],
    ['准备窗口状态第 4 行', 'int bestStart = 0'],
    ['准备窗口状态第 5 行', 'int bestLength = s.length() + 1'],
    ['源串扫描条件', 'right < s.length()'],
    ['读取入窗字符第 1 行', 'int incoming = s.charAt(right)'],
    ['入窗欠账条件', 'need[incoming] > 0'],
    ['减少总欠账第 1 行', 'missing--'],
    ['登记字符入窗第 1 行', 'need[incoming]--'],
    ['覆盖收缩条件', 'missing == 0'],
    ['计算当前长度第 1 行', 'int currentLength = right - left + 1'],
    ['更短窗口条件', 'currentLength < bestLength'],
    ['保存最短窗口第 1 行', 'bestStart = left'],
    ['保存最短窗口第 2 行', 'bestLength = currentLength'],
    ['读取出窗字符第 1 行', 'int outgoing = s.charAt(left)'],
    ['撤销字符入窗第 1 行', 'need[outgoing]++'],
    ['恢复欠账条件', 'need[outgoing] > 0'],
    ['增加总欠账第 1 行', 'missing++'],
    ['左边界前进第 1 行', 'left++'],
    ['右边界前进第 1 行', 'right++'],
    ['无答案条件', 'bestLength > s.length()'],
    ['返回空字符串', 's.substring(0, 0)'],
    ['返回最短窗口', 's.substring(bestStart, bestStart + bestLength)'],
  ]
  for (const [label, value] of fields) {
    await page.getByRole('textbox', { name: label, exact: true }).fill(value)
  }
}

const browser = await chromium.launch({ headless: true })
const errors = []

const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const desktop = await desktopContext.newPage()
attachErrorCapture(desktop, errors, 'desktop')
await desktop.goto(`${baseUrl}/games/minimum-window/`, { waitUntil: 'networkidle' })
await desktop.getByRole('heading', { name: '先亲手框出最短覆盖窗口' }).waitFor()
await assertNoOverflow(desktop, 'desktop manual')

await desktop.getByRole('button', { name: '0 号字符 A', exact: true }).click()
await desktop.getByRole('button', { name: '5 号字符 C', exact: true }).click()
await desktop.getByRole('button', { name: '校验窗口' }).click()
await desktop.getByText('“ADOBEC”还不是最短完整窗口，检查重复次数和两侧边界。', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '重置选窗' }).click()
await reachProgramStage(desktop)
assert.equal(await desktop.locator('[data-program-node]').count(), 0)
assert.equal(await desktop.getByRole('button', { name: '检查并进入调试' }).isDisabled(), true)
await verifyDesktopDragFromShelf(desktop)

await assembleCorrectProgram(desktop)
assert.equal(await desktop.locator('[data-program-node]').count(), 6)
await desktop.getByRole('button', { name: '检查并进入调试' }).click()
await desktop.getByRole('heading', { name: '逐帧观察欠账和边界变化' }).waitFor()
await desktop.getByRole('button', { name: '播放', exact: true }).click()
await desktop.waitForTimeout(850)
await desktop.getByRole('button', { name: '暂停', exact: true }).click()
const pausedCounter = await desktop.locator('.mw-runtime-controls > span').innerText()
await desktop.waitForTimeout(650)
assert.equal(await desktop.locator('.mw-runtime-controls > span').innerText(), pausedCounter)
await desktop.getByRole('button', { name: '重置', exact: true }).click()
await runFirstBatchBySteps(desktop)
await desktop.getByRole('button', { name: '验证更多文字带' }).click()
await desktop.getByRole('button', { name: '校验全部批次' }).click()
await desktop.getByText('同一套窗口规则通过全部文字带，代码实战已解锁。', { exact: true }).waitFor()
const codeStage = desktop.locator('.mw-stage-nav button').filter({ hasText: '代码实战' })
assert.equal(await codeStage.isEnabled(), true)
await desktop.getByRole('button', { name: '重新验证', exact: true }).click()
assert.equal(await codeStage.isDisabled(), true)
assert.equal(await desktop.getByText('同一套窗口规则通过全部文字带，代码实战已解锁。', { exact: true }).count(), 0)
await desktop.getByRole('button', { name: '校验全部批次' }).click()
await desktop.getByText('同一套窗口规则通过全部文字带，代码实战已解锁。', { exact: true }).waitFor()
await assertNoOverflow(desktop, 'desktop verified program')
await desktop.locator('.mw-workspace-stage').scrollIntoViewIfNeeded()
await desktop.screenshot({ path: resolve(root, 'public/previews/minimum-window.png'), fullPage: false })

await desktop.getByRole('button', { name: '进入代码实战' }).click()
await desktop.getByRole('heading', { name: '把欠账窗口写成代码' }).waitFor()
await desktop.getByText('固定作用域已锁定，待填写 24 项语义', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '运行当前用例' }).click()
const firstSlot = desktop.getByRole('textbox', { name: '准备目标登记第 1 行', exact: true })
assert.equal(await firstSlot.evaluate((element) => document.activeElement === element), true)
await fillStructuredSolution(desktop)
await desktop.getByRole('button', { name: '运行当前用例' }).click()
await desktop.getByText('当前用例通过', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '提交全部用例' }).click()
await desktop.getByRole('dialog').waitFor()
assert.match(await desktop.locator('.sp-verification').innerText(), /10 \/ 10/)
assert.ok(await desktop.evaluate(() => localStorage.getItem('skill-programming:minimum-window-substring:completion:v1') !== null))
await desktop.getByRole('button', { name: '查看通关结果' }).click()
await desktop.getByText('全部公开与隐藏用例通过', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '提交全部用例' }).click()
assert.equal(await desktop.getByRole('dialog').count(), 0)
await desktop.reload({ waitUntil: 'networkidle' })
assert.equal(await desktop.getByRole('dialog').count(), 0)
await assertNoOverflow(desktop, 'desktop code reload')

const catalog = await desktopContext.newPage()
await catalog.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
assert.equal(await catalog.locator('[data-challenge-id]').count(), 6)
assert.equal(await catalog.locator('.challenge-track-group').count(), 3)
const catalogPreviews = catalog.locator('.challenge-preview img')
assert.equal(await catalogPreviews.count(), 6)
for (let index = 0; index < await catalogPreviews.count(); index += 1) {
  assert.ok(await catalogPreviews.nth(index).evaluate((image) => (
    image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
  )))
}
const catalogCard = catalog.locator('[data-challenge-id="minimum-window-substring"]')
await catalogCard.waitFor()
assert.equal(await catalogCard.getByText('已开放', { exact: true }).isVisible(), true)
assert.equal(await catalogCard.locator('img').getAttribute('src'), '/previews/minimum-window.png')
assert.ok(await catalogCard.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0))
await catalog.getByLabel('学习专题').selectOption('sliding-window')
assert.equal(await catalog.locator('[data-challenge-id]').count(), 3)
await catalog.getByLabel('解题技巧').selectOption('variable-window')
assert.equal(await catalog.locator('[data-challenge-id]').count(), 2)
await catalog.getByLabel('难度').selectOption('challenge')
assert.equal(await catalog.locator('[data-challenge-id]').count(), 1)
assert.equal(await catalog.locator('[data-challenge-id="minimum-window-substring"]').count(), 1)
await catalog.getByLabel('数据结构').selectOption('array')
await catalog.getByText('没有符合当前筛选的挑战', { exact: true }).waitFor()
await catalog.getByRole('button', { name: '清除筛选', exact: true }).last().click()
assert.equal(await catalog.locator('[data-challenge-id]').count(), 6)
await assertNoOverflow(catalog, 'desktop catalog')
await catalog.close()
await desktopContext.close()

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const mobile = await mobileContext.newPage()
attachErrorCapture(mobile, errors, 'mobile')
await mobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
assert.equal(await mobile.locator('[data-challenge-id]').count(), 6)
await mobile.getByLabel('数据结构').selectOption('string')
assert.equal(await mobile.locator('[data-challenge-id]').count(), 3)
await assertNoOverflow(mobile, 'mobile filtered catalog')
await mobile.goto(`${baseUrl}/games/minimum-window/`, { waitUntil: 'networkidle' })
await assertNoOverflow(mobile, 'mobile manual')
await completeManual(mobile)
await mobile.getByRole('button', { name: '从空程序开始编排' }).tap()
await mobile.getByRole('button', { name: '程序', exact: true }).tap()
await assembleCorrectProgram(mobile)
assert.equal(await mobile.locator('[data-program-node]').count(), 6)
await assertNoOverflow(mobile, 'mobile program')
await mobile.screenshot({ path: resolve(root, 'outputs/minimum-window-program-mobile.png'), fullPage: true })

await mobile.goto(`${baseUrl}/games/minimum-window/?stage=code`, { waitUntil: 'networkidle' })
await mobile.getByRole('button', { name: '编辑', exact: true }).tap()
await mobile.getByRole('radio', { name: '自由编写', exact: true }).tap()
const editor = mobile.locator('.cm-content')
await editor.fill(referenceBody)
await mobile.getByRole('button', { name: '提交全部用例' }).tap()
await mobile.getByRole('dialog').waitFor()
assert.match(await mobile.locator('.sp-verification').innerText(), /10 \/ 10/)
await assertNoOverflow(mobile, 'mobile completion')
await mobile.waitForTimeout(3200)
await mobile.screenshot({ path: resolve(root, 'outputs/minimum-window-completion-mobile.png'), fullPage: false })
await mobile.getByRole('button', { name: '查看通关结果' }).tap()
await mobile.getByText('全部公开与隐藏用例通过', { exact: true }).waitFor()
await mobileContext.close()

assert.deepEqual(errors, [])
await browser.close()

console.log('MINIMUM_WINDOW_E2E_PASS manual preview 6-core-node program debug batches structured free completion repeat reload catalog desktop mobile')
