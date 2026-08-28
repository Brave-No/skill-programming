import { describe, expect, it } from 'vitest'
import {
  composeStructuredBody,
  validateStructuredDraft,
  type StructuredDraft,
} from '../../codePractice/structuredMode'
import { LONGEST_SUBSTRING_CHALLENGE } from './challenge'
import { composeLongestSubstringReferenceBody } from './reference'

const customBody = `int start = 0;
int cursor = 0;
int longest = 0;
int[] seen = new int[128];
while (cursor < s.length()) {
  int code = s.charAt(cursor);
  while (seen[code] != 0) {
    seen[s.charAt(start)] -= 1;
    start += 1;
  }
  seen[code] += 1;
  longest = Math.max(cursor - start + 1, longest);
  cursor += 1;
}
return longest;`

const structuredDraft: StructuredDraft = {
  preparation: `int left = 0;
int right = 0;
int best = 0;
int[] counts = new int[128];`,
  'scan-condition': 'right < s.length()',
  'read-current': 'int current = s.charAt(right)',
  'duplicate-condition': 'counts[current] > 0',
  'release-left': 'counts[s.charAt(left)]--',
  'advance-left': 'left++',
  'admit-current': 'counts[current]++',
  'update-best': 'best = Math.max(best, right - left + 1)',
  'advance-right': 'right++',
  result: 'best',
}

describe('longest substring Java practice', () => {
  it('runs the canonical reference against every public and hidden case', () => {
    const source = composeLongestSubstringReferenceBody()
    expect(LONGEST_SUBSTRING_CHALLENGE.validate(
      LONGEST_SUBSTRING_CHALLENGE.codePractice.runtime.parse(source),
    ).valid).toBe(true)

    for (const testCase of LONGEST_SUBSTRING_CHALLENGE.codePractice.cases) {
      expect(LONGEST_SUBSTRING_CHALLENGE.codePractice.runtime.run(
        source,
        testCase.input,
        testCase.expected,
      )).toMatchObject({ ok: true })
    }
  })

  it('accepts equivalent local variable names and assignment forms', () => {
    const semantic = LONGEST_SUBSTRING_CHALLENGE.validate(
      LONGEST_SUBSTRING_CHALLENGE.codePractice.runtime.parse(customBody),
    )

    expect(semantic.valid).toBe(true)
    expect(LONGEST_SUBSTRING_CHALLENGE.codePractice.runtime.run(customBody, 'abba', 2))
      .toMatchObject({ ok: true })
  })

  it('rejects moving the left boundary before releasing its character', () => {
    const wrongOrder = customBody.replace(
      `seen[s.charAt(start)] -= 1;
    start += 1;`,
      `start += 1;
    seen[s.charAt(start)] -= 1;`,
    )
    const semantic = LONGEST_SUBSTRING_CHALLENGE.validate(
      LONGEST_SUBSTRING_CHALLENGE.codePractice.runtime.parse(wrongOrder),
    )

    expect(semantic.valid).toBe(false)
    expect(semantic.issue?.check).toBe('moveLeft')
  })

  it('keeps a hidden single-character boundary that distinguishes a partial solution', () => {
    const partialBody = customBody.replace(
      'return longest;',
      `if (s.length() == 1) {
  longest = 0;
}
return longest;`,
    )
    expect(LONGEST_SUBSTRING_CHALLENGE.validate(
      LONGEST_SUBSTRING_CHALLENGE.codePractice.runtime.parse(partialBody),
    ).valid).toBe(true)
    LONGEST_SUBSTRING_CHALLENGE.codePractice.cases
      .filter(({ visibility }) => visibility === 'public')
      .forEach((testCase) => expect(
        LONGEST_SUBSTRING_CHALLENGE.codePractice.runtime.run(
          partialBody,
          testCase.input,
          testCase.expected,
        ).ok,
      ).toBe(true))
    expect(LONGEST_SUBSTRING_CHALLENGE.codePractice.runtime.run(partialBody, 'x', 1).ok)
      .toBe(false)
  })

  it('composes the locked scaffold and maps semantic issues to the right slot', () => {
    const composition = composeStructuredBody(
      LONGEST_SUBSTRING_CHALLENGE.codePractice.scaffold,
      structuredDraft,
    )
    expect(validateStructuredDraft(
      LONGEST_SUBSTRING_CHALLENGE,
      structuredDraft,
      composition,
    ).kind).toBe('valid')

    const invalid = validateStructuredDraft(
      LONGEST_SUBSTRING_CHALLENGE,
      { ...structuredDraft, 'advance-left': 'right++' },
    )
    expect(invalid).toMatchObject({
      kind: 'invalid',
      issue: { kind: 'semantic', slotId: 'advance-left' },
    })
  })

  it('keeps concepts linked to real skills, reference steps, mappings, slots and checks', () => {
    const challenge = LONGEST_SUBSTRING_CHALLENGE
    const skillIds = new Set<string>(challenge.skills.map((skill) => skill.type))
    const stepIds = new Set(challenge.codePractice.referenceSteps.map((step) => step.id))
    const mappingIds = new Set(challenge.codePractice.mappings.map((entry) => entry.id))
    const slotIds = new Set(challenge.codePractice.scaffold.slots.map((slot) => slot.id))
    const checks = new Set(Object.keys(challenge.validate(
      challenge.codePractice.runtime.parse(customBody),
    ).checks))

    for (const concept of challenge.concepts) {
      expect(concept.links.sceneIds.length, concept.id).toBeGreaterThan(0)
      concept.links.skillIds.forEach((id) => expect(skillIds.has(id), `${concept.id}:skill:${id}`).toBe(true))
      concept.links.referenceStepIds.forEach((id) => expect(stepIds.has(id), `${concept.id}:step:${id}`).toBe(true))
      concept.links.mappingEntryIds.forEach((id) => expect(mappingIds.has(id), `${concept.id}:mapping:${id}`).toBe(true))
      concept.links.structuredSlotIds.forEach((id) => expect(slotIds.has(id), `${concept.id}:slot:${id}`).toBe(true))
      concept.links.semanticChecks.forEach((id) => expect(checks.has(id), `${concept.id}:check:${id}`).toBe(true))
    }
  })
})
