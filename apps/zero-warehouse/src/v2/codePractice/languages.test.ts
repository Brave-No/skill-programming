import { describe, expect, it } from 'vitest'
import { CODE_LANGUAGE_IDS, type CodeLanguageId } from '../../../../../src/codePractice/languages'
import { CODE_PRACTICE_CASES } from './cases'
import { parseJavaSubset, runJavaSubset } from './javaSubset'
import { createMoveZeroesLanguagePractice } from './languages'
import { analyzeMoveZeroesProgram } from './moveZeroesSemantics'
import {
  composeStructuredBody,
  validateStructuredDraft,
  type StructuredDraft,
} from './structuredMode'

const structuredDrafts: Record<CodeLanguageId, StructuredDraft> = {
  java: {
    preparation: 'int writeIndex = 0',
    'loop-init': 'int scanIndex = 0',
    'loop-condition': 'scanIndex < nums.length',
    'loop-update': 'scanIndex++',
    'occupied-condition': 'nums[scanIndex] != 0',
    swap: 'int temp = nums[scanIndex]\nnums[scanIndex] = nums[writeIndex]\nnums[writeIndex] = temp',
    'slow-update': 'writeIndex++',
  },
  cpp: {
    preparation: 'int writeIndex = 0',
    'loop-init': 'int scanIndex = 0',
    'loop-condition': 'scanIndex < nums.size()',
    'loop-update': 'scanIndex++',
    'occupied-condition': 'nums[scanIndex] != 0',
    swap: 'int temp = nums[scanIndex]\nnums[scanIndex] = nums[writeIndex]\nnums[writeIndex] = temp',
    'slow-update': 'writeIndex++',
  },
  javascript: {
    preparation: 'let writeIndex = 0',
    'loop-init': 'let scanIndex = 0',
    'loop-condition': 'scanIndex < nums.length',
    'loop-update': 'scanIndex++',
    'occupied-condition': 'nums[scanIndex] != 0',
    swap: 'let temp = nums[scanIndex]\nnums[scanIndex] = nums[writeIndex]\nnums[writeIndex] = temp',
    'slow-update': 'writeIndex++',
  },
  python: {
    preparation: 'writeIndex = 0',
    'loop-init': 'scanIndex in range(len(nums))',
    'loop-condition': '',
    'loop-update': '',
    'occupied-condition': 'nums[scanIndex] != 0',
    swap: 'temp = nums[scanIndex]\nnums[scanIndex] = nums[writeIndex]\nnums[writeIndex] = temp',
    'slow-update': 'writeIndex += 1',
  },
}

describe('move zeroes languages', () => {
  it.each(CODE_LANGUAGE_IDS)('runs the complete %s reference against every case', (languageId) => {
    const practice = createMoveZeroesLanguagePractice(languageId)
    const source = practice.reference.steps.map((step) => step.code).join('\n')
    const normalized = practice.normalize(source)
    const analysis = analyzeMoveZeroesProgram(parseJavaSubset(normalized))

    expect(Object.values(analysis.checks).every(Boolean)).toBe(true)
    for (const testCase of CODE_PRACTICE_CASES) {
      expect(runJavaSubset(normalized, testCase.input, testCase.expected).ok).toBe(true)
    }
  })

  it.each(CODE_LANGUAGE_IDS)('keeps %s structured mode executable', (languageId) => {
    const practice = createMoveZeroesLanguagePractice(languageId)
    const draft = structuredDrafts[languageId]
    const composition = composeStructuredBody(draft, practice.scaffold)
    const validation = validateStructuredDraft(draft, composition, {
      normalizeSource: practice.normalize,
      requiredSlotIds: practice.requiredSlotIds,
      issueSlotAliases: practice.issueSlotAliases,
    })

    expect(validation.kind).toBe('valid')
    const normalized = practice.normalize(composition.source)
    for (const testCase of CODE_PRACTICE_CASES) {
      expect(runJavaSubset(normalized, testCase.input, testCase.expected).ok).toBe(true)
    }
  })

  it('uses Python structure instead of displaying Java punctuation', () => {
    const practice = createMoveZeroesLanguagePractice('python')
    const source = composeStructuredBody(structuredDrafts.python, practice.scaffold).source

    expect(source).toContain('for scanIndex in range(len(nums)):')
    expect(source).toContain('if nums[scanIndex] != 0:')
    expect(source).not.toContain(';')
    expect(source).not.toContain('{')
  })
})
