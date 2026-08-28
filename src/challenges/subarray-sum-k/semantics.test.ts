import { describe, expect, it } from 'vitest'
import { parseJavaSubset, runJavaSubset } from '../../codePractice/javaSubset'
import { ARCHIVE_CODE_CASES } from './cases'
import {
  ARCHIVE_MISSING_SEED_BODY,
  ARCHIVE_RECORD_BEFORE_COUNT_BODY,
  ARCHIVE_REFERENCE_BODY,
  ARCHIVE_RENAMED_BODY,
} from './qaFixtures'
import { analyzeArchiveJavaProgram } from './semantics'

describe('subarray sum Java semantics', () => {
  it.each([
    ['canonical', ARCHIVE_REFERENCE_BODY],
    ['renamed and direct difference', ARCHIVE_RENAMED_BODY],
  ])('accepts %s implementation', (_label, source) => {
    expect(analyzeArchiveJavaProgram(parseJavaSubset(source)).valid).toBe(true)
    for (const testCase of ARCHIVE_CODE_CASES) {
      const result = runJavaSubset(source, testCase.input, testCase.expected)
      expect(result.ok, testCase.id).toBe(true)
    }
  })

  it('rejects recording the current prefix before the lookup', () => {
    const semantic = analyzeArchiveJavaProgram(parseJavaSubset(ARCHIVE_RECORD_BEFORE_COUNT_BODY))
    expect(semantic.valid).toBe(false)
    expect(semantic.issue?.check).toBe('record')

    const zeroCase = ARCHIVE_CODE_CASES.find(({ id }) => id === 'hidden-repeat-zero')!
    expect(runJavaSubset(ARCHIVE_RECORD_BEFORE_COUNT_BODY, zeroCase.input, zeroCase.expected).ok).toBe(false)
  })

  it('rejects a frequency table without the empty-prefix seed', () => {
    const semantic = analyzeArchiveJavaProgram(parseJavaSubset(ARCHIVE_MISSING_SEED_BODY))
    expect(semantic.valid).toBe(false)
    expect(semantic.issue?.check).toBe('archive')
  })
})
