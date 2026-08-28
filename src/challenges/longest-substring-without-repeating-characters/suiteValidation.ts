import { interpretWindowProgram } from './interpreter'
import type { WindowInterpretationResult, WindowSkillNode } from './model'
import type { WindowVerificationBatch } from './cases'

export interface WindowBatchCheckResult {
  batchIndex: number
  batch: WindowVerificationBatch
  result: WindowInterpretationResult
}
export interface WindowSuiteCheckResult {
  passed: boolean
  passedIndices: number[]
  failedIndices: number[]
  batches: WindowBatchCheckResult[]
}

export const checkWindowBatches = (
  program: WindowSkillNode[],
  batches: WindowVerificationBatch[],
): WindowSuiteCheckResult => {
  const checked = batches.map((batch, batchIndex) => ({
    batchIndex,
    batch,
    result: interpretWindowProgram(program, batch.source),
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
