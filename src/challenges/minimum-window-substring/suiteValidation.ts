import type { MinimumWindowVerificationBatch } from './cases'
import { interpretMinimumWindowProgram } from './interpreter'
import type { MinimumWindowInterpretationResult, MinimumWindowSkillNode } from './model'

export interface MinimumWindowBatchCheckResult {
  batchIndex: number
  batch: MinimumWindowVerificationBatch
  result: MinimumWindowInterpretationResult
}

export interface MinimumWindowSuiteCheckResult {
  passed: boolean
  passedIndices: number[]
  failedIndices: number[]
  batches: MinimumWindowBatchCheckResult[]
}

export const checkMinimumWindowBatches = (
  program: MinimumWindowSkillNode[],
  batches: MinimumWindowVerificationBatch[],
): MinimumWindowSuiteCheckResult => {
  const checked = batches.map((batch, batchIndex) => ({
    batchIndex,
    batch,
    result: interpretMinimumWindowProgram(program, { source: batch.source, target: batch.target }),
  }))
  const passedIndices = checked.filter(({ result }) => result.success).map(({ batchIndex }) => batchIndex)
  const failedIndices = checked.filter(({ result }) => !result.success).map(({ batchIndex }) => batchIndex)
  return {
    passed: failedIndices.length === 0,
    passedIndices,
    failedIndices,
    batches: checked,
  }
}
