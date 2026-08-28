import { describe, expect, it } from 'vitest'
import { WINDOW_BATCHES } from './cases'
import { findLongestUniqueWindow, interpretWindowProgram } from './interpreter'
import { WINDOW_SKILLS, createWindowSkillNode } from './model'
import { createCorrectWindowProgram } from './qaFixtures'
import { checkWindowBatches } from './suiteValidation'

describe('longest unique substring interpreter', () => {
  it('exposes exactly five memorable skills instead of code-level micro steps', () => {
    expect(WINDOW_SKILLS.map((skill) => skill.type)).toEqual([
      'initialize',
      'scan',
      'shrink-duplicates',
      'admit-current',
      'update-best',
    ])
  })

  it.each([
    ['abcabcbb', 3, 'abc'],
    ['bbbbb', 1, 'b'],
    ['pwwkew', 3, 'wke'],
    ['', 0, ''],
    ['dvdf', 3, 'vdf'],
  ])('finds the longest unique window in %j', (source, length, sample) => {
    const result = findLongestUniqueWindow(source)
    expect(result.length).toBe(length)
    expect(result.start === null ? '' : source.slice(result.start, (result.end ?? -1) + 1)).toBe(sample)
  })

  it('runs one skill program through all formal batches', () => {
    const result = checkWindowBatches(createCorrectWindowProgram(), WINDOW_BATCHES)
    expect(result.batches.flatMap(({ result: batchResult }) => batchResult.error ? [batchResult.error] : [])).toEqual([])
    expect(result.passed).toBe(true)
    expect(result.passedIndices).toEqual([0, 1, 2])
  })

  it('expands one shrink skill into removal and boundary frames', () => {
    const result = interpretWindowProgram(createCorrectWindowProgram('trace'), 'abba')
    const releases = result.frames.filter((frame) => frame.activeNodeId === 'trace-shrink' && frame.message.startsWith('守窗员移出'))
    const leftMoves = result.frames.filter((frame) => frame.activeNodeId === 'trace-shrink' && frame.message.startsWith('守窗员向右'))

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(releases.map((frame) => frame.message)).toEqual([
      '守窗员移出 0 号字符“a”，它的窗口频次减为 0。',
      '守窗员移出 1 号字符“b”，它的窗口频次减为 0。',
    ])
    expect(leftMoves.map((frame) => frame.left)).toEqual([1, 2])
  })

  it('expands character reads and right-boundary moves inside the scan skill', () => {
    const result = interpretWindowProgram(createCorrectWindowProgram('scan-detail'), 'ab')
    const scanFrames = result.frames.filter((frame) => frame.activeNodeId === 'scan-detail-scan')

    expect(scanFrames.filter((frame) => frame.message.startsWith('巡灯员用探照灯读取')).map((frame) => frame.message)).toEqual([
      '巡灯员用探照灯读取 0 号字符“a”。',
      '巡灯员用探照灯读取 1 号字符“b”。',
    ])
    expect(scanFrames.filter((frame) => frame.message.startsWith('本轮完成')).map((frame) => frame.right)).toEqual([1, 2])
  })

  it('shows the exact width operands before updating the record', () => {
    const result = interpretWindowProgram(createCorrectWindowProgram('formula'), 'abc')
    const update = result.frames.find(
      (frame) => frame.activeNodeId === 'formula-best' && frame.bestLength === 3,
    )
    expect(update?.message).toBe('2 - 0 + 1 = 3，最长记录由 2 更新为 3。')
    expect(update).toMatchObject({ bestStart: 0, bestEnd: 2 })
  })

  it('rejects omitting duplicate contraction', () => {
    const scan = createWindowSkillNode('scan', 'bad-scan')
    scan.children = [
      createWindowSkillNode('admit-current', 'bad-admit'),
      createWindowSkillNode('update-best', 'bad-best'),
    ]
    const result = interpretWindowProgram(
      [createWindowSkillNode('initialize', 'bad-init'), scan],
      'abba',
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('需要继续从左侧收缩')
  })

  it('rejects advancing the scan before measuring the valid window', () => {
    const scan = createWindowSkillNode('scan', 'early-scan')
    scan.children = [
      createWindowSkillNode('shrink-duplicates', 'early-shrink'),
      createWindowSkillNode('admit-current', 'early-admit'),
    ]
    const result = interpretWindowProgram(
      [createWindowSkillNode('initialize', 'early-init'), scan],
      'abc',
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('更新最长记录')
  })
})
