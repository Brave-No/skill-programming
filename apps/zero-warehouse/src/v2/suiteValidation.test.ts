import { describe, expect, it } from 'vitest'
import { createConfiguredProgram, createSkillInvocation } from './model'
import { checkAllBatches } from './suiteValidation'

describe('checkAllBatches', () => {
  it('passes all batches without requiring frame playback', () => {
    const check = checkAllBatches(createConfiguredProgram())

    expect(check.passed).toBe(true)
    expect(check.passedIndices).toEqual([0, 1, 2])
    expect(check.failedIndices).toEqual([])
    expect(check.batches.every(({ result }) => result.frames.length > 0)).toBe(true)
  })

  it('checks every batch and reports all failures', () => {
    const loop = createSkillInvocation('for-each', 'suite-empty-loop')
    loop.config.collection = 'warehouse-slots'

    const check = checkAllBatches([loop])

    expect(check.passed).toBe(false)
    expect(check.failedIndices).toEqual([0, 1, 2])
    expect(check.batches).toHaveLength(3)
  })
})
