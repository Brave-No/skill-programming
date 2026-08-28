import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4175'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const previewPath = resolve(root, 'public/previews/find-all-anagrams.png')
const outputs = resolve(root, 'outputs')

const referenceBody = `int[] target = new int[26];
int[] window = new int[26];
int left = 0;
List<Integer> result = new ArrayList<>();
for (int i = 0; i < p.length(); i++) {
  target[p.charAt(i) - 'a']++;
}
for (int right = 0; right < s.length(); right++) {
  window[s.charAt(right) - 'a']++;
  if (right - left + 1 > p.length()) {
    window[s.charAt(left) - 'a']--;
    left++;
  }
  if (Arrays.equals(target, window)) {
    result.add(left);
  }
}
return result;`

const hiddenFailureBody = referenceBody.replace(
  'return result;',
  'if (s.length() == 8) {\n  result.add(0);\n}\nreturn result;',
)

const attachErrorCapture = (page, errors, label) => {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label}:console:${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`${label}:page:${error.message}`))
}

const assertNoOverflow = async (page, label) => {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  assert.ok(metrics.documentWidth <= metrics.innerWidth, `${label}: ${JSON.stringify(metrics)}`)
  assert.ok(metrics.bodyWidth <= metrics.innerWidth, `${label}: ${JSON.stringify(metrics)}`)
}

const shelfButton = (page, label) => page.getByRole('button', { name: `取用技能：${label}`, exact: true })

const programNode = (page, label) => page
  .getByText(label, { exact: true })
  .locator('xpath=ancestor::article[contains(@class, "program-skill")][1]')

const placeRoot = async (page, label, index) => {
  await shelfButton(page, label).click()
  await page.getByRole('button', { name: `主流程第 ${index + 1} 个放置位置`, exact: true }).click()
}

const placeNested = async (page, label, parentLabel, index) => {
  await shelfButton(page, label).click()
  const scope = programNode(page, parentLabel).locator(':scope > .program-scope--nested')
  await scope.locator(':scope > button.program-drop-slot').nth(index).click()
}

const dragSkillToRoot = async (page, label, index) => {
  const source = page.getByRole('button', { name: `取用技能：${label}`, exact: true })
  const target = page.getByRole('button', { name: `主流程第 ${index + 1} 个放置位置`, exact: true })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  assert.ok(sourceBox && targetBox)
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.locator('.drag-overlay').waitFor({ state: 'hidden' })
}

const assembleProgram = async (page) => {
  await placeRoot(page, '建立目标频谱', 0)
  await placeRoot(page, '向右扫描源信号', 1)
  await placeNested(page, '纳入右侧字母', '向右扫描源信号', 0)
  await placeNested(page, '超宽时收缩左侧', '向右扫描源信号', 1)
  await placeNested(page, '匹配时记录起点', '向右扫描源信号', 2)
}

const fillStructuredSolution = async (page) => {
  const fields = [
    ['准备频谱状态第 1 行', 'int[] target = new int[26]'],
    ['准备频谱状态第 2 行', 'int[] window = new int[26]'],
    ['准备频谱状态第 3 行', 'int left = 0'],
    ['准备频谱状态第 4 行', 'List<Integer> result = new ArrayList<>()'],
    ['目标循环起点', 'int i = 0'],
    ['目标循环条件', 'i < p.length()'],
    ['目标读头前进', 'i++'],
    ['累计目标字母第 1 行', "target[p.charAt(i) - 'a']++"],
    ['源串循环起点', 'int right = 0'],
    ['源串循环条件', 'right < s.length()'],
    ['右探针前进', 'right++'],
    ['纳入右侧字母第 1 行', "window[s.charAt(right) - 'a']++"],
    ['判断窗口超宽', 'right - left + 1 > p.length()'],
    ['移出左侧字母第 1 行', "window[s.charAt(left) - 'a']--"],
    ['推进左边界第 1 行', 'left++'],
    ['比较两份频谱', 'Arrays.equals(target, window)'],
    ['记录窗口起点第 1 行', 'result.add(left)'],
    ['返回命中列表', 'result'],
  ]
  for (const [label, value] of fields) {
    await page.getByRole('textbox', { name: label, exact: true }).fill(value)
  }
}

const completeManual = async (page) => {
  await page.getByRole('button', { name: '选择从 0 开始的窗口', exact: true }).click()
  await page.getByRole('button', { name: '选择从 6 开始的窗口', exact: true }).click()
  await page.getByText('0 和 6 两个窗口都与目标频谱一致，可以进入技能台。', { exact: true }).waitFor()
  await page.getByRole('button', { name: '进入频谱技能台' }).click()
}

const setFreeCode = async (page, code) => {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
}

const browser = await chromium.launch({ headless: true })
const errors = []

const desktopContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const desktop = await desktopContext.newPage()
attachErrorCapture(desktop, errors, 'desktop')
await desktop.goto(`${baseUrl}/games/find-all-anagrams/`, { waitUntil: 'networkidle' })
await desktop.getByRole('heading', { name: '找出同频窗口', exact: true }).waitFor()
await assertNoOverflow(desktop, 'desktop manual')

await desktop.getByRole('button', { name: '选择从 1 开始的窗口', exact: true }).click()
await desktop.getByText('1 号窗口频谱不同；再次点击可以取消选择。', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '选择从 1 开始的窗口', exact: true }).click()
await completeManual(desktop)
await desktop.getByRole('heading', { name: '编排固定滑窗规则', exact: true }).waitFor()
assert.equal(await desktop.locator('[data-program-node]').count(), 0)

await desktop.getByRole('button', { name: '预演技能：建立目标频谱', exact: true }).click()
await desktop.getByRole('dialog').waitFor()
assert.equal(await desktop.locator('[data-program-node]').count(), 0)
await desktop.getByRole('button', { name: '重播技能预演', exact: true }).click()
await desktop.keyboard.press('Escape')
assert.equal(await desktop.getByRole('dialog').count(), 0)

await dragSkillToRoot(desktop, '建立目标频谱', 0)
assert.equal(await desktop.locator('[data-program-node]').count(), 1)
await placeRoot(desktop, '向右扫描源信号', 1)
await desktop.getByRole('button', { name: '移动技能：向右扫描源信号', exact: true }).click()
await desktop.getByRole('button', { name: '主流程第 1 个放置位置', exact: true }).click()
const firstProgramTitle = desktop.locator(
  '.program-scope--root > article.program-skill > .program-skill__header .program-skill__title',
).first()
assert.equal(await firstProgramTitle.innerText(), '向右扫描源信号')
await desktop.getByRole('button', { name: '校验全部批次', exact: true }).click()
await desktop.getByText('3 批未通过', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '查看第 1 批', exact: true }).click()
await desktop.getByRole('button', { name: '重置执行', exact: true }).click()
await desktop.getByRole('button', { name: '清空滑窗程序', exact: true }).click()
assert.equal(await desktop.locator('[data-program-node]').count(), 0)

await assembleProgram(desktop)
assert.equal(await desktop.locator('[data-program-node]').count(), 5)
await desktop.getByRole('button', { name: '运行当前批次', exact: true }).click()
await desktop.getByRole('button', { name: '暂停', exact: true }).waitFor()
await desktop.getByRole('button', { name: '暂停', exact: true }).click()
await desktop.getByRole('button', { name: '单步执行', exact: true }).click()
await desktop.getByRole('button', { name: '重置执行', exact: true }).click()

await desktop.getByRole('button', { name: '校验全部批次', exact: true }).click()
await desktop.getByText('全部批次通过', { exact: true }).waitFor()
await assertNoOverflow(desktop, 'desktop verified program')
await desktop.locator('.anagram-workbench').scrollIntoViewIfNeeded()
await desktop.screenshot({ path: previewPath, fullPage: false })

await desktop.getByRole('button', { name: '删除技能：匹配时记录起点', exact: true }).click()
await desktop.getByText('0 / 3 批通过', { exact: true }).waitFor()
assert.equal(await desktop.getByRole('button', { name: '进入代码实战', exact: true }).isDisabled(), true)
await placeNested(desktop, '匹配时记录起点', '向右扫描源信号', 2)
await desktop.getByRole('button', { name: '校验全部批次', exact: true }).click()
await desktop.getByRole('button', { name: '进入代码实战', exact: true }).click()

await desktop.getByRole('heading', { name: '把频谱滑窗写成代码', exact: true }).waitFor()
await desktop.getByText('固定作用域已锁定，待填写 15 项语义', { exact: true }).waitFor()
const firstSlot = desktop.getByRole('textbox', { name: '准备频谱状态第 1 行', exact: true })
await desktop.getByRole('button', { name: '复制代码段：准备频谱台', exact: true }).click()
assert.equal(await firstSlot.inputValue(), '')
await desktop.getByRole('button', { name: '运行当前用例', exact: true }).click()
assert.equal(await firstSlot.evaluate((element) => document.activeElement === element), true)
await fillStructuredSolution(desktop)
await desktop.getByRole('button', { name: '运行当前用例', exact: true }).click()
await desktop.getByText('当前用例通过', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '提交全部用例', exact: true }).click()
await desktop.getByRole('dialog').waitFor()
assert.match(await desktop.locator('.sp-verification').innerText(), /9 \/ 9/)
assert.equal(await desktop.evaluate(() => localStorage.getItem('skill-programming:find-all-anagrams:completion:v1') !== null), true)
await desktop.getByRole('button', { name: '重播通关动画', exact: true }).click()
await desktop.keyboard.press('Escape')
assert.equal(await desktop.getByRole('dialog').count(), 0)
await desktop.getByText('全部公开与隐藏用例通过', { exact: true }).waitFor()
await desktop.getByRole('button', { name: '提交全部用例', exact: true }).click()
assert.equal(await desktop.getByRole('dialog').count(), 0)

await desktop.getByRole('radio', { name: '自由编写', exact: true }).click()
await setFreeCode(desktop, hiddenFailureBody)
await desktop.getByRole('button', { name: '提交全部用例', exact: true }).click()
await desktop.getByText('还有用例没有通过', { exact: true }).waitFor()
await desktop.getByText('隐藏 · 提交后揭示', { exact: true }).waitFor()
await setFreeCode(desktop, referenceBody)
await desktop.getByRole('button', { name: '提交全部用例', exact: true }).click()
await desktop.getByText('全部公开与隐藏用例通过', { exact: true }).waitFor()
assert.equal(await desktop.getByRole('dialog').count(), 0)
await desktop.getByText('草稿已保存', { exact: true }).waitFor()
await desktop.reload({ waitUntil: 'networkidle' })
assert.equal(await desktop.getByRole('dialog').count(), 0)
await desktop.goto(`${baseUrl}/games/find-all-anagrams/?stage=code`, { waitUntil: 'networkidle' })
assert.equal(await desktop.getByRole('radio', { name: '自由编写', exact: true }).getAttribute('aria-checked'), 'true')
assert.match(await desktop.locator('.cm-content').innerText(), /Arrays\.equals/)
await assertNoOverflow(desktop, 'desktop code reload')

const catalog = await desktopContext.newPage()
attachErrorCapture(catalog, errors, 'catalog')
await catalog.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
assert.equal(await catalog.locator('[data-challenge-id]').count(), 6)
const card = catalog.locator('[data-challenge-id="find-all-anagrams"]')
await card.waitFor()
assert.equal(await card.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0), true)
await catalog.getByLabel('学习专题').selectOption({ label: '滑动窗口' })
assert.equal(await catalog.locator('[data-challenge-id]').count(), 3)
await catalog.getByRole('button', { name: '清除筛选', exact: true }).click()
await catalog.getByLabel('学习专题').selectOption({ label: '前缀和' })
await catalog.getByLabel('数据结构').selectOption({ label: '字符串' })
await catalog.getByText('没有符合当前筛选的挑战', { exact: true }).waitFor()
await catalog.getByRole('status').getByRole('button', { name: '清除筛选', exact: true }).click()
assert.equal(await catalog.locator('[data-challenge-id]').count(), 6)
await assertNoOverflow(catalog, 'desktop catalog')
await catalog.close()

const rainline = await desktopContext.newPage()
attachErrorCapture(rainline, errors, 'rainline-regression')
await rainline.goto(`${baseUrl}/games/rainline/`, { waitUntil: 'networkidle' })
for (const [index, height] of [[1, 0], [2, 2], [3, 0]]) {
  await rainline.getByRole('button', { name: `标记 ${index} 号位置，高度 ${height}` }).click()
}
await rainline.getByRole('button', { name: '降雨验证', exact: true }).click()
await rainline.getByText('判断准确', { exact: true }).waitFor()
await rainline.getByRole('button', { name: '进入巡检台', exact: true }).click()
await rainline.getByRole('heading', { name: '巡检技能', exact: true }).waitFor()
assert.equal(await rainline.locator('[data-program-node]').count(), 0)
await dragSkillToRoot(rainline, '低岸向内一步', 0)
assert.equal(await rainline.locator('[data-program-node]').count(), 1)
await rainline.getByRole('button', { name: '删除技能：低岸向内一步', exact: true }).click()
await rainline.waitForFunction(() => document.querySelectorAll('[data-program-node]').length === 0)
await placeRoot(rainline, '双端就位', 0)
await placeRoot(rainline, '巡检直到相遇', 1)
await placeNested(rainline, '选择较低岸线', '巡检直到相遇', 0)
await placeNested(rainline, '低岸向内一步', '巡检直到相遇', 1)
await placeNested(rainline, '更新最高柱', '巡检直到相遇', 2)
await placeNested(rainline, '计算当前积水', '巡检直到相遇', 3)
assert.equal(await rainline.locator('[data-program-node]').count(), 6)
await rainline.getByRole('button', { name: '校验全部批次', exact: true }).click()
await rainline.getByText('全部地形已直接校验通过。', { exact: true }).waitFor()
await rainline.getByRole('button', { name: '删除技能：更新最高柱', exact: true }).click()
await rainline.waitForFunction(() => document.querySelectorAll('[data-program-node]').length === 5)
assert.equal(await rainline.getByText('全部地形已直接校验通过。', { exact: true }).count(), 0)
await placeNested(rainline, '更新最高柱', '巡检直到相遇', 2)
await rainline.getByRole('button', { name: '校验全部批次', exact: true }).click()
await rainline.getByText('全部地形已直接校验通过。', { exact: true }).waitFor()
await assertNoOverflow(rainline, 'rainline shared builder regression')
await rainline.close()
await desktopContext.close()

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const mobile = await mobileContext.newPage()
attachErrorCapture(mobile, errors, 'mobile')
await mobile.goto(`${baseUrl}/games/find-all-anagrams/`, { waitUntil: 'networkidle' })
await assertNoOverflow(mobile, 'mobile manual')
await completeManual(mobile)
await assertNoOverflow(mobile, 'mobile program')
await mobile.goto(`${baseUrl}/games/find-all-anagrams/?stage=code`, { waitUntil: 'networkidle' })
await mobile.getByRole('button', { name: '编辑', exact: true }).tap()
await mobile.getByRole('radio', { name: '自由编写', exact: true }).tap()
await setFreeCode(mobile, referenceBody)
await mobile.getByRole('button', { name: '提交全部用例', exact: true }).tap()
await mobile.getByRole('dialog').waitFor()
await assertNoOverflow(mobile, 'mobile completion')
await mobile.waitForTimeout(3200)
await mobile.screenshot({ path: resolve(outputs, 'find-all-anagrams-completion-mobile.png'), fullPage: false })
await mobile.getByRole('button', { name: '查看通关结果', exact: true }).tap()
await mobile.getByText('全部公开与隐藏用例通过', { exact: true }).waitFor()
await assertNoOverflow(mobile, 'mobile code')
await mobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
assert.equal(await mobile.locator('[data-challenge-id]').count(), 6)
await assertNoOverflow(mobile, 'mobile catalog')
await mobile.screenshot({ path: resolve(outputs, 'find-all-anagrams-catalog-mobile.png'), fullPage: true })
await mobileContext.close()

assert.deepEqual(errors, [])
await browser.close()

console.log('FIND_ALL_ANAGRAMS_E2E_PASS manual preview builder runtime code completion catalog desktop mobile')
