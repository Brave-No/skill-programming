import { describe, expect, it } from 'vitest'
import { parseJavaSubset } from '../../codePractice/javaSubset'
import { MINIMUM_WINDOW_BATCHES, findMinimumWindow } from './cases'
import { MINIMUM_WINDOW_CONCEPTS } from './concepts'
import { validateMinimumWindowProgram } from './contracts'
import { interpretMinimumWindowProgram } from './interpreter'
import {
  createCorrectMinimumWindowProgram,
  createNoShrinkProgram,
  createWrongDebtOrderProgram,
  EQUIVALENT_MINIMUM_WINDOW_JAVA,
} from './qaFixtures'
import type { MinimumWindowSkillNode } from './model'
import { checkMinimumWindowBatches } from './suiteValidation'
import {
  composeMinimumWindowReferenceBody,
  MINIMUM_WINDOW_MAPPINGS,
  MINIMUM_WINDOW_REFERENCE_STEPS,
  MINIMUM_WINDOW_SCAFFOLD,
} from './reference'
import { analyzeMinimumWindowProgram } from './semantics'

describe('minimum window substring challenge engine', () => {
  it('finds canonical and repeated-character windows', () => {
    expect(findMinimumWindow({ source: 'ADOBECODEBANC', target: 'ABC' })).toBe('BANC')
    expect(findMinimumWindow({ source: 'AAABBC', target: 'AABC' })).toBe('AABBC')
    expect(findMinimumWindow({ source: 'a', target: 'aa' })).toBe('')
    expect(findMinimumWindow({ source: 'aA', target: 'A' })).toBe('A')
  })

  it('executes the complete causal program on every official batch', () => {
    const check = checkMinimumWindowBatches(createCorrectMinimumWindowProgram(), MINIMUM_WINDOW_BATCHES)
    expect(check.passed).toBe(true)
    expect(check.passedIndices).toEqual([0, 1, 2])
  })

  it('exposes debt changes, formula operands, and both boundary updates', () => {
    const result = interpretMinimumWindowProgram(
      createCorrectMinimumWindowProgram(),
      { source: 'ADOBECODEBANC', target: 'ABC' },
    )
    expect(result.success).toBe(true)
    expect(result.result).toBe('BANC')
    expect(result.frames.some((frame) => frame.message.includes('总欠账 3 -> 2'))).toBe(true)
    expect(result.frames.some((frame) => frame.message.includes(' - ') && frame.message.includes(' + 1 = '))).toBe(true)
    expect(result.frames.some((frame) => frame.message.includes('左标尺从'))).toBe(true)
    expect(result.frames.some((frame) => frame.message.includes('右标尺从'))).toBe(true)
  })

  it('rejects contracting before the incoming character is recorded', () => {
    const program = createWrongDebtOrderProgram()
    expect(validateMinimumWindowProgram(program).valid).toBe(false)
    const result = interpretMinimumWindowProgram(program, { source: 'ADOBECODEBANC', target: 'ABC' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('依次执行')
  })

  it('rejects a program that never runs covered-window contraction', () => {
    const program = createNoShrinkProgram()
    expect(validateMinimumWindowProgram(program).valid).toBe(false)
    const result = interpretMinimumWindowProgram(program, { source: 'ADOBECODEBANC', target: 'ABC' })
    expect(result.success).toBe(false)
  })

  it('keeps an empty program neutral until a run is requested', () => {
    const result = interpretMinimumWindowProgram([], { source: 'ABC', target: 'A' })
    expect(result.frames[0].status).toBe('idle')
    expect(result.frames.at(-1)?.status).toBe('error')
    expect(result.error).toContain('当前作用域需要依次执行')
  })

  it('keeps every concept link connected to a real challenge artifact', () => {
    const skillIds = new Set(createCorrectMinimumWindowProgram().flatMap(function collect(node: MinimumWindowSkillNode): string[] {
      return [node.type, ...node.children.flatMap(collect)]
    }))
    const referenceIds = new Set(MINIMUM_WINDOW_REFERENCE_STEPS.map((step) => step.id))
    const mappingIds = new Set(MINIMUM_WINDOW_MAPPINGS.map((entry) => entry.id))
    const slotIds = new Set(MINIMUM_WINDOW_SCAFFOLD.slots.map((slot) => slot.id))

    for (const concept of MINIMUM_WINDOW_CONCEPTS) {
      concept.links.skillIds.forEach((id) => expect(skillIds.has(id), `${concept.id} -> skill ${id}`).toBe(true))
      concept.links.referenceStepIds.forEach((id) => expect(referenceIds.has(id), `${concept.id} -> reference ${id}`).toBe(true))
      concept.links.mappingEntryIds.forEach((id) => expect(mappingIds.has(id), `${concept.id} -> mapping ${id}`).toBe(true))
      concept.links.structuredSlotIds.forEach((id) => expect(slotIds.has(id), `${concept.id} -> slot ${id}`).toBe(true))
    }
  })

  it('recognizes the canonical Java body by roles, scopes, data flow, and order', () => {
    const semantic = analyzeMinimumWindowProgram(
      parseJavaSubset(composeMinimumWindowReferenceBody()),
    )
    expect(semantic.valid, semantic.issue?.message).toBe(true)
    expect(Object.values(semantic.checks).every(Boolean)).toBe(true)
  })

  it('accepts equivalent Java with renamed variables and reversed comparisons', () => {
    const semantic = analyzeMinimumWindowProgram(
      parseJavaSubset(EQUIVALENT_MINIMUM_WINDOW_JAVA),
    )
    expect(semantic.valid, semantic.issue?.message).toBe(true)
  })
})
