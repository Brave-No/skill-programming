import { describe, expect, it } from 'vitest'
import { runJavaSubset } from '../../codePractice/javaSubset'
import { MINIMUM_WINDOW_CHALLENGE } from './challenge'
import { MINIMUM_WINDOW_CODE_CASES } from './cases'
import {
  EQUIVALENT_MINIMUM_WINDOW_JAVA,
  WRONG_DISTINCT_ONLY_JAVA,
} from './qaFixtures'
import { composeMinimumWindowReferenceBody } from './reference'

const runAll = (source: string) => MINIMUM_WINDOW_CODE_CASES.map((testCase) => (
  MINIMUM_WINDOW_CHALLENGE.codePractice.runtime.run(source, testCase.input, testCase.expected)
))

describe('minimum window Java practice', () => {
  it('executes the canonical reference against every public and hidden case', () => {
    const results = runAll(composeMinimumWindowReferenceBody())
    expect(results.every((result) => result.ok)).toBe(true)
  })

  it('executes an equivalent renamed implementation against every case', () => {
    const results = runAll(EQUIVALENT_MINIMUM_WINDOW_JAVA)
    expect(results.every((result) => result.ok)).toBe(true)
  })

  it('distinguishes a character-set shortcut from repeated target debt', () => {
    const results = runAll(WRONG_DISTINCT_ONLY_JAVA)
    expect(results[0].ok).toBe(true)
    expect(results.some((result) => !result.ok)).toBe(true)
  })

  it('returns strings and rejects invalid substring bounds safely', () => {
    expect(runJavaSubset<string>('return s.substring(1, 3);', { s: 'BANC' }, 'AN').ok).toBe(true)
    const invalid = runJavaSubset<string>('return s.substring(3, 1);', { s: 'BANC' }, '')
    expect(invalid.ok).toBe(false)
    expect(invalid.kind).toBe('runtime')
    expect(invalid.message).toContain('截取范围')
  })
})
