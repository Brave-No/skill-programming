import { describe, expect, it } from 'vitest'
import { SUBARRAY_SUM_K_CHALLENGE } from './challenge'
import { ARCHIVE_SKILLS } from './model'
import { ARCHIVE_REFERENCE_BODY, ARCHIVE_RENAMED_BODY } from './qaFixtures'

describe('subarray sum challenge specification', () => {
  it('exposes exactly five core skills instead of code-level micro operations', () => {
    expect(ARCHIVE_SKILLS.map(({ type }) => type)).toEqual([
      'initialize-archive',
      'scan-values',
      'accumulate-prefix',
      'count-matches',
      'record-prefix',
    ])
  })

  it('links every concept to existing challenge entities', () => {
    const skillIds = new Set<string>(SUBARRAY_SUM_K_CHALLENGE.skills.map(({ type }) => type))
    const referenceIds = new Set(SUBARRAY_SUM_K_CHALLENGE.codePractice.referenceSteps.map(({ id }) => id))
    const mappingIds = new Set(SUBARRAY_SUM_K_CHALLENGE.codePractice.mappings.map(({ id }) => id))
    const slotIds = new Set(SUBARRAY_SUM_K_CHALLENGE.codePractice.scaffold.slots.map(({ id }) => id))
    const checks = new Set(Object.keys(SUBARRAY_SUM_K_CHALLENGE.codePractice.checkToSlot))

    for (const concept of SUBARRAY_SUM_K_CHALLENGE.concepts) {
      expect(concept.links.skillIds.every((id) => skillIds.has(id)), concept.id).toBe(true)
      expect(concept.links.referenceStepIds.every((id) => referenceIds.has(id)), concept.id).toBe(true)
      expect(concept.links.mappingEntryIds.every((id) => mappingIds.has(id)), concept.id).toBe(true)
      expect(concept.links.structuredSlotIds.every((id) => slotIds.has(id)), concept.id).toBe(true)
      expect(concept.links.semanticChecks.every((id) => checks.has(id)), concept.id).toBe(true)
    }
  })

  it.each([
    ['canonical', ARCHIVE_REFERENCE_BODY],
    ['equivalent renamed', ARCHIVE_RENAMED_BODY],
  ])('passes every code case with the %s implementation', (_label, source) => {
    expect(SUBARRAY_SUM_K_CHALLENGE.validate(SUBARRAY_SUM_K_CHALLENGE.codePractice.runtime.parse(source)).valid).toBe(true)
    for (const testCase of SUBARRAY_SUM_K_CHALLENGE.codePractice.cases) {
      expect(
        SUBARRAY_SUM_K_CHALLENGE.codePractice.runtime.run(source, testCase.input, testCase.expected).ok,
        testCase.id,
      ).toBe(true)
    }
  })
})
