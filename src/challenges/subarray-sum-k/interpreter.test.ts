import { describe, expect, it } from 'vitest'
import { ARCHIVE_BATCHES, countTargetSubarrays } from './cases'
import { validateArchiveProgram } from './contracts'
import { interpretArchiveProgram } from './interpreter'
import { createCorrectArchiveProgram, createRecordBeforeCountProgram } from './qaFixtures'

describe('subarray sum archive program', () => {
  it('counts public verification batches with one program', () => {
    const program = createCorrectArchiveProgram()
    expect(validateArchiveProgram(program).valid).toBe(true)
    for (const batch of ARCHIVE_BATCHES) {
      expect(interpretArchiveProgram(program, batch.values, batch.target)).toMatchObject({
        success: true,
        answer: batch.expected,
      })
    }
  })

  it('keeps zero-target duplicates and negative values distinguishable', () => {
    expect(countTargetSubarrays([0, 0, 0], 0)).toBe(6)
    expect(countTargetSubarrays([1, -1, 0], 0)).toBe(3)
    expect(countTargetSubarrays([-1, -1, 1], -1)).toBe(3)
  })

  it('rejects recording the current prefix before counting old matches', () => {
    const validation = validateArchiveProgram(createRecordBeforeCountProgram())
    expect(validation.valid).toBe(false)
    expect(validation.issues.some((issue) => issue.message.includes('本轮已累加'))).toBe(true)
  })

  it('expands one counting skill into separate formula and lookup frames', () => {
    const result = interpretArchiveProgram(createCorrectArchiveProgram(), [1, 1, 1], 2)
    expect(result.frames.some((frame) => frame.message.includes('1 - 目标 2 = 目标旧刻度 -1'))).toBe(true)
    expect(result.frames.some((frame) => frame.message.includes('读取当前变化 1'))).toBe(true)
    expect(result.frames.some((frame) => frame.message.includes('命中计数 0 + 1 = 1'))).toBe(true)
    expect(result.frames.some((frame) => frame.message.includes('档案次数 0 -> 1'))).toBe(true)
    expect(result.frames.some((frame) => frame.message.includes('探针从 0 号站前进到 1 号站'))).toBe(true)
    expect(result.frames.at(-1)).toMatchObject({ status: 'success', answer: 2 })
  })
})
