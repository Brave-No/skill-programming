import { describe, expect, it } from 'vitest'
import { ANAGRAM_BATCHES } from './cases'
import { createCorrectAnagramProgram, createMissingRemovalProgram } from './qaFixtures'
import { checkAnagramBatches } from './suiteValidation'

describe('find-all-anagrams suite validation', () => {
  it('passes only after the canonical program matches every batch output', () => {
    const result = checkAnagramBatches(createCorrectAnagramProgram('suite'), ANAGRAM_BATCHES)

    expect(result.passed).toBe(true)
    expect(result.passedIndices).toEqual([0, 1, 2])
    expect(result.failedIndices).toEqual([])
    expect(result.batches.map(({ result: batchResult }) => batchResult.matches)).toEqual(
      ANAGRAM_BATCHES.map(({ expected }) => expected),
    )
  })

  it('keeps every batch failed when the skill program contract is incomplete', () => {
    const result = checkAnagramBatches(createMissingRemovalProgram('suite-invalid'), ANAGRAM_BATCHES)

    expect(result.passed).toBe(false)
    expect(result.passedIndices).toEqual([])
    expect(result.failedIndices).toEqual([0, 1, 2])
    expect(result.batches[0].result.error).toContain('判断窗口是否超宽')
  })

  it('does not treat successful execution with a wrong expected output as passed', () => {
    const alteredBatches = ANAGRAM_BATCHES.map((batch, index) => index === 1
      ? { ...batch, expected: [0, 2] }
      : batch)
    const result = checkAnagramBatches(createCorrectAnagramProgram('suite-output'), alteredBatches)

    expect(result.passed).toBe(false)
    expect(result.passedIndices).toEqual([0, 2])
    expect(result.failedIndices).toEqual([1])
  })
})
