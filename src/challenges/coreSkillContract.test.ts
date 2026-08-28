import { describe, expect, it } from 'vitest'
import { ANAGRAM_CHALLENGE } from './find-all-anagrams/challenge'
import { LONGEST_SUBSTRING_CHALLENGE } from './longest-substring-without-repeating-characters/challenge'
import { MINIMUM_WINDOW_CHALLENGE } from './minimum-window-substring/challenge'
import { SUBARRAY_SUM_K_CHALLENGE } from './subarray-sum-k/challenge'

const refinedChallenges = [
  { challenge: SUBARRAY_SUM_K_CHALLENGE, expectedSkillCount: 5 },
  { challenge: LONGEST_SUBSTRING_CHALLENGE, expectedSkillCount: 5 },
  { challenge: ANAGRAM_CHALLENGE, expectedSkillCount: 5 },
  { challenge: MINIMUM_WINDOW_CHALLENGE, expectedSkillCount: 6 },
] as const

describe('refined core skill contract', () => {
  it.each(refinedChallenges)(
    '$challenge.id keeps $expectedSkillCount core skills while preserving finer code steps',
    ({ challenge, expectedSkillCount }) => {
      expect(challenge.skills).toHaveLength(expectedSkillCount)
      expect(challenge.skills.length).toBeGreaterThanOrEqual(4)
      expect(challenge.skills.length).toBeLessThanOrEqual(7)
      expect(challenge.codePractice.referenceSteps.length).toBeGreaterThan(challenge.skills.length)

      const skillIds = new Set<string>(challenge.skills.map((skill) => skill.type))
      for (const concept of challenge.concepts) {
        concept.links.skillIds.forEach((skillId) => {
          expect(skillIds.has(skillId), `${challenge.id}:${concept.id}:${skillId}`).toBe(true)
        })
      }
    },
  )

  it('does not require every implementation detail to become a skill card', () => {
    const detailOnlyConcepts = refinedChallenges.flatMap(({ challenge }) => (
      challenge.concepts.filter((concept) => (
        concept.links.skillIds.length === 0
        && concept.links.traceFields.length > 0
        && concept.links.referenceStepIds.length > 0
        && concept.links.semanticChecks.length > 0
      ))
    ))

    expect(detailOnlyConcepts.length).toBeGreaterThan(0)
  })
})
