import { describe, expect, it } from 'vitest'
import {
  FUTURE_MAPPING_EXAMPLE,
  JAVA_MAPPING,
  JAVA_MAPPING_ENTRIES,
  MAPPING_CATEGORY_ORDER,
  analyzeMappingOccurrences,
} from './mappings'
import { CORRECT_JAVA_BODY } from './qaFixtures'

describe('code mapping model', () => {
  it('keeps the Java mapping language-specific while covering every atomic category', () => {
    expect(JAVA_MAPPING.languageId).toBe('java')
    expect(new Set(JAVA_MAPPING_ENTRIES.map((entry) => entry.category))).toEqual(new Set(MAPPING_CATEGORY_ORDER))
    for (const concept of ['nums', 'writeIndex', 'scanIndex', 'for', 'if', 'nums.length', '++']) {
      expect(JAVA_MAPPING_ENTRIES.some((entry) => entry.snippets.some((snippet) => snippet.code.includes(concept)))).toBe(true)
    }
  })

  it('keeps future data-structure methods as independent entries', () => {
    expect(FUTURE_MAPPING_EXAMPLE.category).toBe('api-method')
    expect(FUTURE_MAPPING_EXAMPLE.snippets[0].code).toContain('map.put')
    expect(FUTURE_MAPPING_EXAMPLE.patterns.some((pattern) => pattern.includes('put'))).toBe(true)
  })

  it('reports concept occurrences by source line and leaves absent concepts empty', () => {
    const emptyOccurrences = analyzeMappingOccurrences('')
    expect([...emptyOccurrences.values()].every((lines) => lines.length === 0)).toBe(true)

    const occurrences = analyzeMappingOccurrences(CORRECT_JAVA_BODY)
    expect(occurrences.get('skill-traverse')).toEqual([2])
    expect(occurrences.get('skill-check-occupied')).toEqual([3])
    expect(occurrences.get('scene-load-hand')).toEqual([1, 5, 6, 7])
    expect(occurrences.get('api-array-length')).toEqual([2])

    const absent = analyzeMappingOccurrences('int only = 1;')
    expect(absent.get('scene-scan-hand')).toEqual([])
  })
})
