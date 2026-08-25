import { describe, expect, it } from 'vitest'
import { parseJavaSubset, runJavaSubset } from './javaSubset'
import {
  JAVA_LOGIC_REFERENCE,
  analyzeLogicStepProgress,
  composeLogicBody,
} from './logicReference'
import { CORRECT_JAVA_BODY } from './qaFixtures'
import { CODE_PRACTICE_CASES } from './cases'

describe('structured logic reference', () => {
  it('keeps every step in execution order with the expected nesting', () => {
    expect(JAVA_LOGIC_REFERENCE.steps.map((step) => step.id)).toEqual([
      'initialize-write-pointer',
      'open-scan-loop',
      'open-cargo-condition',
      'swap-cargo',
      'advance-write-pointer',
      'close-cargo-condition',
      'close-scan-loop',
    ])
    expect(JAVA_LOGIC_REFERENCE.steps.map((step) => step.depth)).toEqual([0, 0, 1, 2, 2, 1, 0])
    expect(JAVA_LOGIC_REFERENCE.steps.every((step) => step.skillType && step.scopePath.length > 0)).toBe(true)
    expect(JAVA_LOGIC_REFERENCE.steps.map((step) => step.structuredSlotIds)).toEqual([
      ['preparation'],
      ['loop-init', 'loop-condition', 'loop-update'],
      ['occupied-condition'],
      ['swap'],
      ['slow-update'],
      [],
      [],
    ])
    expect(JAVA_LOGIC_REFERENCE.steps.filter((step) => step.role === 'close-scope').every((step) => (
      step.lockedStructure && step.structuredSlotIds.length === 0
    ))).toBe(true)
  })

  it('composes the complete fixture including the three-line swap and both closing braces', () => {
    const body = composeLogicBody(JAVA_LOGIC_REFERENCE)
    expect(body).toBe(CORRECT_JAVA_BODY)
    expect(body).toContain('int temp = nums[scanIndex];')
    expect(body).toContain('nums[scanIndex] = nums[writeIndex];')
    expect(body).toContain('nums[writeIndex] = temp;')
    expect(body.match(/{/g)).toHaveLength(2)
    expect(body.match(/}/g)).toHaveLength(2)
    expect(() => parseJavaSubset(body)).not.toThrow()
  })

  it('passes every public and boundary case without relying on another answer fixture', () => {
    for (const testCase of CODE_PRACTICE_CASES) {
      expect(runJavaSubset(composeLogicBody(JAVA_LOGIC_REFERENCE), testCase.input, testCase.expected).ok).toBe(true)
    }
  })

  it('keeps the full reference independent from empty-player progress', () => {
    expect(JAVA_LOGIC_REFERENCE.steps).toHaveLength(7)
    expect([...analyzeLogicStepProgress('').values()].every((written) => !written)).toBe(true)
    expect([...analyzeLogicStepProgress(CORRECT_JAVA_BODY).values()].every(Boolean)).toBe(true)
  })
})
