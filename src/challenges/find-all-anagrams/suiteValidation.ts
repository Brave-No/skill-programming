import type { AnagramVerificationBatch } from './cases'
import { interpretAnagramProgram } from './interpreter'
import type { AnagramInterpretationResult, AnagramSkillNode } from './model'

export interface AnagramBatchCheck {
  batchIndex: number
  batch: AnagramVerificationBatch
  result: AnagramInterpretationResult
  passed: boolean
}

export interface AnagramSuiteCheck {
  passed: boolean
  passedIndices: number[]
  failedIndices: number[]
  batches: AnagramBatchCheck[]
}

export const checkAnagramBatches = (
  program: AnagramSkillNode[],
  batches: AnagramVerificationBatch[],
): AnagramSuiteCheck => {
  const checks = batches.map((batch, batchIndex) => {
    const result = interpretAnagramProgram(program, batch.input)
    return {
      batchIndex,
      batch,
      result,
      passed: result.success
        && result.matches.length === batch.expected.length
        && result.matches.every((value, index) => value === batch.expected[index]),
    }
  })
  return {
    passed: checks.every(({ passed }) => passed),
    passedIndices: checks.filter(({ passed }) => passed).map(({ batchIndex }) => batchIndex),
    failedIndices: checks.filter(({ passed }) => !passed).map(({ batchIndex }) => batchIndex),
    batches: checks,
  }
}
