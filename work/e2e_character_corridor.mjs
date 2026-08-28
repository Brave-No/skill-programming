import { chromium } from '/Users/edy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176'
const completionKey = 'skill-programming:longest-substring-without-repeating-characters:completion:v1'
const correctBody = `int left = 0;
int right = 0;
int best = 0;
int[] counts = new int[128];
while (right < s.length()) {
  int current = s.charAt(right);
  while (counts[current] > 0) {
    counts[s.charAt(left)]--;
    left++;
  }
  counts[current]++;
  best = Math.max(best, right - left + 1);
  right++;
}
return best;`

const assertNoOverflow = async (page, label) => {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  assert(metrics.documentWidth <= metrics.innerWidth, `${label}: document overflow ${JSON.stringify(metrics)}`)
  assert(metrics.bodyWidth <= metrics.innerWidth, `${label}: body overflow ${JSON.stringify(metrics)}`)
}

const attachErrors = (page, errors) => {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`))
}

const clickPlacement = async (page, skill, location) => {
  await page.getByRole('button', { name: `取用技能：${skill}` }).click()
  await page.getByRole('button', { name: location, exact: true }).click()
}

const fillFreeEditor = async (page, source) => {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(source)
  await page.waitForTimeout(450)
}

const pointerDrag = async (page, source, target) => {
  const sourceBox = await source.boundingBox()
  assert(sourceBox, 'drag source must have a bounding box')
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2 + 8, { steps: 3 })
  await page.locator('.corridor-drag-overlay').waitFor({ timeout: 2000 })
  await page.waitForTimeout(120)
  const targetBox = await target.boundingBox()
  assert(targetBox, 'expanded drop target must have a bounding box')
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.waitForTimeout(120)
  const overLabels = await page.locator('.corridor-drop-slot.is-over').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
  assert(overLabels.length > 0, 'drag must activate a drop target')
  await page.mouse.up()
  await page.waitForTimeout(180)
  return overLabels
}

const browser = await chromium.launch({ headless: true })
const errors = []

const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const desktop = await desktopContext.newPage()
attachErrors(desktop, errors)
await desktop.goto(`${BASE_URL}/`)
await desktop.waitForLoadState('networkidle')
const preview = desktop.locator('[data-challenge-id="longest-substring-without-repeating-characters"] img')
assert(await preview.evaluate((image) => image.complete && image.naturalWidth > 0), 'catalog preview must load')
await desktop.getByLabel('学习专题').selectOption('sliding-window')
await desktop.getByLabel('解题技巧').selectOption('variable-window')
assert.equal(await desktop.locator('[data-challenge-id]').count(), 2, 'combined filters should narrow the catalog')
await desktop.getByLabel('开放状态').selectOption('coming-soon')
await desktop.getByText('没有符合当前筛选的挑战').waitFor()
await desktop.getByRole('status').getByRole('button', { name: '清除筛选' }).click()
assert.equal(await desktop.locator('[data-challenge-id]').count(), 6, 'clear should restore all challenges')
await assertNoOverflow(desktop, 'desktop catalog filters')
await desktop.goto(`${BASE_URL}/games/character-corridor/`)
await desktop.waitForLoadState('networkidle')
await desktop.getByRole('heading', { name: '圈出最长无重复窗口' }).waitFor()
await assertNoOverflow(desktop, 'desktop manual')

await desktop.getByRole('button', { name: /0 号字符 a/ }).click()
await desktop.getByRole('button', { name: /1 号字符 b/ }).click()
await desktop.getByText('观察完成').waitFor()
await desktop.getByRole('button', { name: '进入技能认识' }).click()

assert.equal(await desktop.locator('[aria-label="窗口技能因果顺序"] > button').count(), 5, 'skill introduction must show five core steps')
await desktop.getByRole('button', { name: /初始化灯廊/ }).first().click()
const skillDialog = desktop.getByRole('dialog')
await skillDialog.waitFor()
await skillDialog.getByRole('img', { name: /守窗员/ }).waitFor()
await skillDialog.getByRole('img', { name: /巡灯员/ }).waitFor()
assert.equal(await skillDialog.locator('.corridor-pointer').count(), 0, 'skill previews must not fall back to abstract L/R markers')
await desktop.screenshot({ path: 'outputs/character-corridor-skill-roles-desktop.png', fullPage: false })
await desktop.getByRole('button', { name: '重新播放技能预演' }).click()
await desktop.getByRole('button', { name: '关闭技能预演' }).click()
await desktop.getByRole('button', { name: /扫描直到末尾/ }).first().click()
await skillDialog.locator('.corridor-operator--scout.state-moving').waitFor()
await desktop.waitForTimeout(850)
await desktop.screenshot({ path: 'outputs/character-corridor-scout-action-desktop.png', fullPage: false })
await desktop.getByRole('button', { name: '关闭技能预演' }).click()
await desktop.getByRole('button', { name: /重复时收缩窗口/ }).first().click()
await skillDialog.locator('.corridor-operator--keeper.state-clearing').waitFor()
await desktop.waitForTimeout(850)
await desktop.screenshot({ path: 'outputs/character-corridor-keeper-action-desktop.png', fullPage: false })
await desktop.getByRole('button', { name: '关闭技能预演' }).click()
await desktop.getByRole('button', { name: '从空程序开始' }).click()
await desktop.getByRole('img', { name: /守窗员/ }).waitFor()
await desktop.getByRole('img', { name: /巡灯员/ }).waitFor()
assert.equal(await desktop.getByText('守窗员', { exact: true }).count(), 1, 'runtime scene must show the left-boundary character identity')
assert.equal(await desktop.getByText('巡灯员', { exact: true }).count(), 1, 'runtime scene must show the right-boundary character identity')
assert.equal(await desktop.locator('.corridor-pointer').count(), 0, 'runtime scene must use characters instead of abstract L/R markers')
assert.equal(await desktop.getByRole('button', { name: /^取用技能：/ }).count(), 5, 'skill shelf must expose five core skills')
for (const retiredMicroSkill of ['读取当前字符', '移出左端字符', '左边界右移', '扫描头前进']) {
  assert.equal(
    await desktop.getByRole('button', { name: `取用技能：${retiredMicroSkill}`, exact: true }).count(),
    0,
    `${retiredMicroSkill} must stay inside execution frames instead of returning to the skill shelf`,
  )
}
assert.equal(await desktop.locator('[data-program-node]').count(), 0, 'program should start empty')

await clickPlacement(desktop, '初始化灯廊', '主流程第 1 个放置位置')
await clickPlacement(desktop, '扫描直到末尾', '主流程第 2 个放置位置')
await clickPlacement(desktop, '重复时收缩窗口', '字符扫描作用域第 1 个放置位置')
await clickPlacement(desktop, '纳入当前字符', '字符扫描作用域第 2 个放置位置')
await clickPlacement(desktop, '更新最长记录', '字符扫描作用域第 3 个放置位置')
assert.equal(await desktop.locator('[data-program-node]').count(), 5, 'expected five core program nodes')

const dragTargets = await pointerDrag(
  desktop,
  desktop.locator('[data-skill-type="update-best"] .corridor-drag-handle'),
  desktop.getByRole('button', { name: '主流程第 3 个放置位置', exact: true }),
)
assert(
  dragTargets.includes('主流程第 3 个放置位置') || dragTargets.includes('字符扫描作用域第 4 个放置位置'),
  `mouse drag should hit a legal reorder target: ${JSON.stringify(dragTargets)}`,
)
const rootNodeCountAfterDrag = await desktop.locator('[data-scope="root"] > [data-program-node]').count()
const lastNestedTypeAfterDrag = await desktop.locator('[data-scope] > [data-program-node]').last().getAttribute('data-skill-type')
assert(
  rootNodeCountAfterDrag === 3 || lastNestedTypeAfterDrag === 'update-best',
  'mouse drag should change the node scope or order',
)
await desktop.getByRole('button', { name: '移动技能：更新最长记录' }).click()
await desktop.getByRole('button', { name: '字符扫描作用域第 3 个放置位置', exact: true }).click()

await clickPlacement(desktop, '纳入当前字符', '主流程第 3 个放置位置')
assert.equal(await desktop.locator('[data-program-node]').count(), 6, 'temporary node should be placed')
await desktop.getByRole('button', { name: '移动技能：纳入当前字符' }).last().click()
await desktop.getByRole('button', { name: '移回技能架' }).click()
assert.equal(await desktop.locator('[data-program-node]').count(), 5, 'moving back to shelf removes the instance')
await desktop.getByText('程序节点 5', { exact: true }).waitFor()

await assertNoOverflow(desktop, 'desktop program')
await desktop.evaluate(() => window.scrollTo(0, 0))
await desktop.waitForTimeout(200)
await desktop.screenshot({ path: 'public/previews/character-corridor.png', fullPage: false })
await desktop.screenshot({ path: 'outputs/character-corridor-program-desktop.png', fullPage: true })

await desktop.getByRole('button', { name: '进入调试执行' }).click()
await desktop.getByRole('button', { name: '运行当前批次' }).click()
await desktop.getByRole('button', { name: '进入多批验证' }).waitFor({ timeout: 45000 })
await desktop.getByRole('button', { name: '进入多批验证' }).click()
await desktop.getByRole('button', { name: '校验全部批次' }).click()
await desktop.getByText('全部字符带通过').waitFor()
await desktop.getByRole('button', { name: '进入代码实战' }).click()
await desktop.getByRole('radio', { name: '自由编写' }).click()

await fillFreeEditor(desktop, correctBody.replace(
  'return best;',
  'if (s.length() == 1) { best = 0; }\nreturn best;',
))
await desktop.getByRole('button', { name: '提交全部用例' }).click()
await desktop.getByText('当前卡住的用例').waitFor()
await desktop.getByText('隐藏 · 提交后揭示').waitFor()
assert.equal(await desktop.getByRole('dialog').count(), 0, 'failed submission must not celebrate')

await fillFreeEditor(desktop, correctBody)
await desktop.getByRole('button', { name: '提交全部用例' }).click()
await desktop.getByRole('dialog').waitFor()
assert(await desktop.evaluate((key) => localStorage.getItem(key) !== null, completionKey), 'completion fact must be saved before dialog')
await desktop.getByRole('button', { name: '跳过通关动画' }).click()
await desktop.getByText('全部公开与隐藏用例通过').waitFor()
await desktop.getByRole('button', { name: '提交全部用例' }).click()
await desktop.waitForTimeout(450)
assert.equal(await desktop.getByRole('dialog').count(), 0, 'repeat submit must not replay celebration')
await desktop.reload()
await desktop.waitForLoadState('networkidle')
assert.equal(await desktop.getByRole('dialog').count(), 0, 'refresh must not replay celebration')

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
const mobile = await mobileContext.newPage()
attachErrors(mobile, errors)
await mobile.goto(`${BASE_URL}/`)
await mobile.waitForLoadState('networkidle')
await assertNoOverflow(mobile, 'mobile catalog filters')
await mobile.goto(`${BASE_URL}/games/character-corridor/`)
await mobile.waitForLoadState('networkidle')
await assertNoOverflow(mobile, 'mobile manual')
await mobile.getByRole('button', { name: /0 号字符 a/ }).tap()
await mobile.getByRole('button', { name: /1 号字符 b/ }).tap()
await mobile.getByRole('button', { name: '进入技能认识' }).tap()
assert.equal(await mobile.locator('[aria-label="窗口技能因果顺序"] > button').count(), 5, 'mobile skill introduction must show five core steps')
await mobile.getByRole('button', { name: '从空程序开始' }).tap()
await mobile.getByRole('img', { name: /守窗员/ }).waitFor()
await mobile.getByRole('img', { name: /巡灯员/ }).waitFor()
assert.equal(await mobile.getByRole('button', { name: /^取用技能：/ }).count(), 5, 'mobile shelf must expose five core skills')
await mobile.getByRole('button', { name: '取用技能：初始化灯廊' }).tap()
await mobile.getByRole('button', { name: '主流程第 1 个放置位置', exact: true }).tap()
await mobile.getByRole('button', { name: '取用技能：扫描直到末尾' }).tap()
await mobile.getByRole('button', { name: '主流程第 2 个放置位置', exact: true }).tap()
await mobile.getByRole('button', { name: '取用技能：重复时收缩窗口' }).tap()
await mobile.getByRole('button', { name: '字符扫描作用域第 1 个放置位置', exact: true }).tap()
await mobile.getByRole('button', { name: '取用技能：纳入当前字符' }).tap()
await mobile.getByRole('button', { name: '字符扫描作用域第 2 个放置位置', exact: true }).tap()
await mobile.getByRole('button', { name: '取用技能：更新最长记录' }).tap()
await mobile.getByRole('button', { name: '字符扫描作用域第 3 个放置位置', exact: true }).tap()
assert.equal(await mobile.locator('[data-program-node]').count(), 5, 'touch placement should build the five-skill algorithm skeleton')
await mobile.getByText('程序节点 5', { exact: true }).waitFor()
await assertNoOverflow(mobile, 'mobile program')
await mobile.screenshot({ path: 'outputs/character-corridor-program-mobile.png', fullPage: true })

const reducedContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
})
const reduced = await reducedContext.newPage()
attachErrors(reduced, errors)
await reduced.goto(`${BASE_URL}/games/character-corridor/?stage=code`)
await reduced.waitForLoadState('networkidle')
await reduced.getByRole('button', { name: '编辑' }).click()
await reduced.getByRole('radio', { name: '自由编写' }).click()
await fillFreeEditor(reduced, correctBody)
await reduced.getByRole('button', { name: '提交全部用例' }).click()
await reduced.getByRole('dialog').waitFor()
await reduced.getByRole('heading', { name: '关卡通关' }).waitFor()
await assertNoOverflow(reduced, 'mobile reduced-motion completion')
await reduced.screenshot({ path: 'outputs/character-corridor-completion-mobile-reduced.png', fullPage: false })
await reduced.keyboard.press('Escape')
assert.equal(await reduced.getByRole('dialog').count(), 0, 'Escape should close completion')

assert.deepEqual(errors, [], `browser errors: ${errors.join('\n')}`)
await browser.close()
console.log('CHARACTER_CORRIDOR_E2E_PASS operator-roles five-core-skills internal-detail-frames manual preview empty-program placement nested-return playback batches hidden-failure completion desktop-mobile-reduced')
