import { describe, expect, it } from 'vitest'
import { CODE_PRACTICE_CASES } from './cases'
import { runJavaSubset } from './javaSubset'
import { analyzeLogicStepProgress } from './logicReference'
import {
  STRUCTURED_SCAFFOLD,
  composeStructuredBody,
  createEmptyStructuredDraft,
  slotForDiagnostic,
  validateStructuredDraft,
  type StructuredDraft,
} from './structuredMode'

const customNamedDraft: StructuredDraft = {
  preparation: `int len = nums.length;
int fast = 0;
int slow = 0;`,
  'loop-init': 'fast = 0',
  'loop-condition': 'fast < len',
  'loop-update': 'fast++',
  'occupied-condition': 'nums[fast] != 0',
  swap: `int tmp = nums[slow];
nums[slow] = nums[fast];
nums[fast] = tmp;`,
  'slow-update': 'slow++',
}

describe('locked structured code mode', () => {
  it('defines fixed tokens, scopes, and slot line counts in the shared scaffold model', () => {
    const lineNodes = STRUCTURED_SCAFFOLD.body.filter((node) => node.kind === 'line')
    const fixedTokens = lineNodes.flatMap((node) => (
      node.segments.filter((segment) => segment.kind === 'fixed').map((segment) => segment.value)
    ))
    expect(fixedTokens).toEqual(['for (', '; ', '; ', ') {', 'if (', ') {', ';'])
    expect(STRUCTURED_SCAFFOLD.body.filter((node) => node.kind === 'fixed-line').map((node) => node.value)).toEqual(['}', '}'])
    expect(STRUCTURED_SCAFFOLD.body.filter((node) => node.kind === 'statement-group').map((node) => (
      [node.slotId, node.lineCount, node.statementTerminator]
    ))).toEqual([
      ['preparation', 3, ';'],
      ['swap', 3, ';'],
    ])
  })

  it('keeps the fixed for/if tree and only composes the seven slot values', () => {
    const composition = composeStructuredBody(customNamedDraft)
    expect(composition.source).toBe(`int len = nums.length;
int fast = 0;
int slow = 0;

for (fast = 0; fast < len; fast++) {
  if (nums[fast] != 0) {
    int tmp = nums[slow];
    nums[slow] = nums[fast];
    nums[fast] = tmp;
    slow++;
  }
}`)
    expect(composition.source.match(/{/g)).toHaveLength(2)
    expect(composition.source.match(/}/g)).toHaveLength(2)
  })

  it('accepts custom variable names and passes every public and hidden case', () => {
    const composition = composeStructuredBody(customNamedDraft)
    expect(validateStructuredDraft(customNamedDraft, composition)).toEqual({ kind: 'valid' })
    expect([...analyzeLogicStepProgress(composition.source).values()].every(Boolean)).toBe(true)
    for (const testCase of CODE_PRACTICE_CASES) {
      expect(runJavaSubset(composition.source, testCase.input, testCase.expected).ok).toBe(true)
    }
  })

  it('reports an empty slot before parsing the fixed scaffold', () => {
    const validation = validateStructuredDraft(createEmptyStructuredDraft())
    expect(validation.kind).toBe('invalid')
    if (validation.kind === 'invalid') {
      expect(validation.issue.kind).toBe('required')
      expect(validation.issue.slotId).toBe('preparation')
    }
  })

  it('maps parser diagnostics on the shared for line back to the exact slot', () => {
    const draft = { ...customNamedDraft, 'loop-condition': 'fast <' }
    const composition = composeStructuredBody(draft)
    const validation = validateStructuredDraft(draft, composition)
    expect(validation.kind).toBe('invalid')
    if (validation.kind === 'invalid') {
      expect(validation.issue.kind).toBe('syntax')
      expect(validation.issue.slotId).toBe('loop-condition')
      expect(validation.issue.diagnostic).toBeDefined()
    }
    expect(slotForDiagnostic(composition, { line: 5, column: 21 })).toBe('loop-condition')
  })

  it('points semantic role mistakes at the corresponding editable slot', () => {
    const validation = validateStructuredDraft({ ...customNamedDraft, 'loop-update': 'slow++' })
    expect(validation.kind).toBe('invalid')
    if (validation.kind === 'invalid') {
      expect(validation.issue.kind).toBe('semantic')
      expect(validation.issue.slotId).toBe('loop-update')
    }
  })
})
