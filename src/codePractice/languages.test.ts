import { describe, expect, it } from 'vitest'
import { ANAGRAM_CHALLENGE } from '../challenges/find-all-anagrams/challenge'
import { LONGEST_SUBSTRING_CHALLENGE } from '../challenges/longest-substring-without-repeating-characters/challenge'
import { MINIMUM_WINDOW_CHALLENGE } from '../challenges/minimum-window-substring/challenge'
import { SUBARRAY_SUM_K_CHALLENGE } from '../challenges/subarray-sum-k/challenge'
import { RAIN_WATER_CHALLENGE } from '../challenges/trapping-rain-water/challenge'
import type { AlgorithmChallenge } from '../challenges/types'
import { composeStructuredBody, validateStructuredDraft } from './structuredMode'
import {
  CODE_LANGUAGE_IDS,
  createLanguageChallenge,
  normalizeLanguageSource,
  translateJavaSource,
  translateMethodSignature,
} from './languages'

const challenges: AlgorithmChallenge<any, any, any, any, any, any>[] = [
  RAIN_WATER_CHALLENGE,
  SUBARRAY_SUM_K_CHALLENGE,
  LONGEST_SUBSTRING_CHALLENGE,
  MINIMUM_WINDOW_CHALLENGE,
  ANAGRAM_CHALLENGE,
]

describe('code practice languages', () => {
  it.each(CODE_LANGUAGE_IDS)('runs every canonical solution as %s', (languageId) => {
    for (const baseChallenge of challenges) {
      const challenge = createLanguageChallenge(baseChallenge, languageId)
      const source = challenge.codePractice.referenceSteps.map((step) => step.code).join('\n')
      const program = challenge.codePractice.runtime.parse(source)
      const semantic = challenge.validate(program)

      expect(semantic.valid, `${baseChallenge.id}:${languageId}:semantic`).toBe(true)
      for (const testCase of challenge.codePractice.cases) {
        expect(
          challenge.codePractice.runtime.run(source, testCase.input, testCase.expected).ok,
          `${baseChallenge.id}:${languageId}:${testCase.id}`,
        ).toBe(true)
      }
    }
  })

  it('translates the four method signatures without changing the method contract', () => {
    const signature = 'List<Integer> findAnagrams(String s, String p)'
    expect(translateMethodSignature(signature, 'cpp')).toBe('vector<int> findAnagrams(const string& s, const string& p)')
    expect(translateMethodSignature(signature, 'python')).toBe('def findAnagrams(s, p)')
    expect(translateMethodSignature(signature, 'javascript')).toBe('function findAnagrams(s, p)')
    expect(translateMethodSignature(signature, 'java')).toBe(signature)
  })

  it('normalizes learner-selected variable names instead of matching reference names', () => {
    const python = `write = 0
for scan in range(len(nums)):
    if nums[scan] != 0:
        cargo = nums[scan]
        nums[scan] = nums[write]
        nums[write] = cargo
        write += 1`
    const java = normalizeLanguageSource(python, 'python', 'void moveZeroes(int[] nums)')

    expect(java).toContain('for (int scan = 0; scan < nums.length; scan++) {')
    expect(java).toContain('int cargo = nums[scan];')
    expect(java).toContain('write += 1;')
  })

  it('keeps unsupported syntax visible to the existing safe parser', () => {
    const source = translateJavaSource('while (true) {\n}', 'javascript')
    const normalized = normalizeLanguageSource(source, 'javascript', 'int trap(int[] height)')
    expect(normalized).toContain('while (true)')
  })

  it('keeps Python structured for-loops idiomatic and semantically complete', () => {
    const challenge = createLanguageChallenge(ANAGRAM_CHALLENGE, 'python')
    const draft = {
      preparation: `target = [0] * 26
window = [0] * 26
left = 0
result = []`,
      'pattern-loop-init': 'i in range(len(p))',
      'target-count': "target[p[i] - 'a'] += 1",
      'source-loop-init': 'right in range(len(s))',
      'add-incoming': "window[s[right] - 'a'] += 1",
      'overflow-condition': 'right - left + 1 > len(p)',
      'remove-outgoing': "window[s[left] - 'a'] -= 1",
      'advance-left': 'left += 1',
      'match-condition': 'target == window',
      'record-index': 'result.append(left)',
      result: 'result',
    }
    const composition = composeStructuredBody(challenge.codePractice.scaffold, draft)
    const validation = validateStructuredDraft(challenge, draft, composition)

    expect(challenge.codePractice.scaffold.slots.some((slot) => slot.id === 'pattern-loop-condition')).toBe(false)
    expect(composition.source).toContain('for i in range(len(p)):')
    expect(composition.source).not.toContain(';')
    expect(validation.kind).toBe('valid')
  })
})
