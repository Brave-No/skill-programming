import { describe, expect, it } from 'vitest'
import { ANAGRAM_BATCHES, ANAGRAM_CODE_CASES, findAnagramIndices } from './cases'
import { ANAGRAM_CONCEPTS } from './concepts'
import { interpretAnagramProgram } from './interpreter'
import { validateAnagramSkillProgram } from './model'
import { createCorrectAnagramProgram, createMissingRemovalProgram } from './qaFixtures'
import { ANAGRAM_MAPPINGS, ANAGRAM_REFERENCE_STEPS, ANAGRAM_SCAFFOLD } from './reference'

describe('find-all-anagrams challenge kernel', () => {
  it('runs the canonical skill program through every verification batch', () => {
    const program = createCorrectAnagramProgram()
    expect(validateAnagramSkillProgram(program)).toEqual({ valid: true })

    for (const batch of ANAGRAM_BATCHES) {
      const result = interpretAnagramProgram(program, batch.input)
      expect(result.success, result.error).toBe(true)
      expect(result.matches).toEqual(batch.expected)
      expect(result.frames.at(-1)?.status).toBe('success')
    }
  })

  it('rejects a program that omits fixed-window contraction', () => {
    const validation = validateAnagramSkillProgram(createMissingRemovalProgram())
    expect(validation.valid).toBe(false)
    expect(validation.issue?.message).toContain('判断窗口是否超宽')
  })

  it('exposes the causal order for incoming, outgoing, boundary and match updates', () => {
    const result = interpretAnagramProgram(
      createCorrectAnagramProgram('causal'),
      { source: 'baa', pattern: 'aa' },
    )
    const messages = result.frames.map((frame) => frame.message)
    const incoming = messages.findIndex((message) => message.includes('进入字母'))
    const outgoing = messages.findIndex((message) => message.includes('离开字母'))
    const advance = messages.findIndex((message) => message.includes('左侧夹具从'))
    const match = messages.findIndex((message) => message.includes('频谱完全一致'))
    expect(incoming).toBeGreaterThan(-1)
    expect(outgoing).toBeGreaterThan(incoming)
    expect(advance).toBeGreaterThan(outgoing)
    expect(match).toBeGreaterThan(advance)
  })

  it('covers public, overlapping, empty-result and boundary code cases', () => {
    expect(ANAGRAM_CODE_CASES.filter(({ visibility }) => visibility === 'public')).toHaveLength(3)
    expect(findAnagramIndices({ source: 'abababab', pattern: 'aab' })).toEqual([0, 2, 4])
    expect(findAnagramIndices({ source: 'abc', pattern: 'abcd' })).toEqual([])
    expect(findAnagramIndices({ source: 'a', pattern: 'a' })).toEqual([0])
  })

  it('keeps every concept linked to declared reference, mapping and slot facts', () => {
    const conceptIds = new Set(ANAGRAM_CONCEPTS.map(({ id }) => id))
    const referenceIds = new Set(ANAGRAM_REFERENCE_STEPS.map(({ id }) => id))
    const mappingIds = new Set(ANAGRAM_MAPPINGS.map(({ id }) => id))
    const slotIds = new Set(ANAGRAM_SCAFFOLD.slots.map(({ id }) => id))

    for (const concept of ANAGRAM_CONCEPTS) {
      expect(concept.links.sceneIds.length, `${concept.id}: scene`).toBeGreaterThan(0)
      expect(concept.links.traceFields.length, `${concept.id}: trace`).toBeGreaterThan(0)
      expect(concept.links.referenceStepIds.length, `${concept.id}: reference`).toBeGreaterThan(0)
      expect(concept.links.mappingEntryIds.length, `${concept.id}: mapping`).toBeGreaterThan(0)
      expect(concept.links.structuredSlotIds.length, `${concept.id}: slot`).toBeGreaterThan(0)
      expect(concept.links.semanticChecks.length, `${concept.id}: check`).toBeGreaterThan(0)
      concept.links.referenceStepIds.forEach((id) => expect(referenceIds.has(id), `${concept.id} -> ${id}`).toBe(true))
      concept.links.mappingEntryIds.forEach((id) => expect(mappingIds.has(id), `${concept.id} -> ${id}`).toBe(true))
      concept.links.structuredSlotIds.forEach((id) => expect(slotIds.has(id), `${concept.id} -> ${id}`).toBe(true))
    }

    for (const step of ANAGRAM_REFERENCE_STEPS) {
      step.conceptIds.forEach((id) => expect(conceptIds.has(id), `${step.id} -> ${id}`).toBe(true))
    }
    for (const mapping of ANAGRAM_MAPPINGS) {
      mapping.conceptIds.forEach((id) => expect(conceptIds.has(id), `${mapping.id} -> ${id}`).toBe(true))
    }
    for (const slot of ANAGRAM_SCAFFOLD.slots) {
      slot.conceptIds.forEach((id) => expect(conceptIds.has(id), `${slot.id} -> ${id}`).toBe(true))
    }
  })
})
