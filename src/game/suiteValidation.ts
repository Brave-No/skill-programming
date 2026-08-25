import type { VerificationBatch } from '../challenges/types'
import { interpretProgram } from './interpreter'
import type { InterpretationResult, SkillNode } from './model'

export interface BatchCheckResult {
  batchIndex: number
  batch: VerificationBatch
  result: InterpretationResult
}

export interface SuiteCheckResult {
  passed: boolean
  passedIndices: number[]
  failedIndices: number[]
  batches: BatchCheckResult[]
}

export const checkAllBatches = (
  program: SkillNode[],
  batches: VerificationBatch[],
): SuiteCheckResult => {
  const checkedBatches = batches.map((batch, batchIndex) => ({
    batchIndex,
    batch,
    result: interpretProgram(program, batch.terrain),
  }))
  const passedIndices = checkedBatches
    .filter(({ result }) => result.success)
    .map(({ batchIndex }) => batchIndex)
  const failedIndices = checkedBatches
    .filter(({ result }) => !result.success)
    .map(({ batchIndex }) => batchIndex)

  return {
    passed: failedIndices.length === 0,
    passedIndices,
    failedIndices,
    batches: checkedBatches,
  }
}
