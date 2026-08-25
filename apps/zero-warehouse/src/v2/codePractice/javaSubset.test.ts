import { describe, expect, it } from 'vitest'
import { BATCHES } from '../../game/model'
import { parseJavaSubset, runJavaSubset } from './javaSubset'
import { CORRECT_JAVA_BODY } from './qaFixtures'

describe('java subset parser and executor', () => {
  it('treats an empty method body as a real, non-solving submission', () => {
    const result = runJavaSubset('', BATCHES[0].input, BATCHES[0].expected)
    expect(result.ok).toBe(false)
    expect(result.kind).toBe('output')
    expect(result.values).toEqual(BATCHES[0].input)
  })

  it('runs the hand-written double-pointer program for all public batches', () => {
    for (const batch of BATCHES) {
      const result = runJavaSubset(CORRECT_JAVA_BODY, batch.input, batch.expected)
      expect(result.ok).toBe(true)
      expect(result.values).toEqual(batch.expected)
    }
  })

  it('handles empty, all-zero, no-zero, one-item, and mixed boundary inputs', () => {
    const cases = [
      [],
      [0, 0, 0],
      [1, 2, 3],
      [0],
      [7, 0, 0, 4, 0, 9],
    ]
    for (const input of cases) {
      const result = runJavaSubset(CORRECT_JAVA_BODY, input)
      expect(result.ok).toBe(true)
      expect(result.values).toEqual(input.filter((value) => value !== 0).concat(input.filter((value) => value === 0)))
    }
  })

  it('reports output errors instead of matching a fixed answer string', () => {
    const result = runJavaSubset(
      `int writeIndex = 0;
for (int scanIndex = 0; scanIndex < nums.length; scanIndex++) {
  if (nums[scanIndex] != 0) writeIndex++;
}`,
      [0, 4, 0, 2, 9],
    )
    expect(result.ok).toBe(false)
    expect(result.kind).toBe('output')
    expect(result.values).toEqual([0, 4, 0, 2, 9])
  })

  it('distinguishes syntax, unsupported syntax, runtime, and timeout errors', () => {
    expect(runJavaSubset('int writeIndex = 0', [0]).kind).toBe('syntax')
    expect(runJavaSubset('while (true) { writeIndex++; }', [0]).kind).toBe('unsupported')
    expect(runJavaSubset('nums[nums.length] = 1;', [0]).kind).toBe('runtime')
    expect(runJavaSubset('for (int i = 0; i < 1; i--) { }', [0], [0], { maxSteps: 12, maxMilliseconds: 80 }).kind).toBe('timeout')
  })

  it('exposes a structured program for mapping and editor diagnostics', () => {
    const program = parseJavaSubset(CORRECT_JAVA_BODY)
    expect(program.type).toBe('program')
    expect(program.statements.some((statement) => statement.type === 'for')).toBe(true)
  })
})
