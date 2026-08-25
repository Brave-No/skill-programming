import { BATCHES, type InterpretationResult } from '../game/model'
import { interpretSkillProgram } from './interpreter'
import type { SkillInvocation } from './model'

export interface BatchCheckResult {
  batchIndex: number
  result: InterpretationResult
}

export interface SuiteCheckResult {
  passed: boolean
  batches: BatchCheckResult[]
  passedIndices: number[]
  failedIndices: number[]
}

export const checkAllBatches = (program: SkillInvocation[]): SuiteCheckResult => {
  const batches = BATCHES.map((batch, batchIndex) => ({
    batchIndex,
    result: interpretSkillProgram(program, batch.input),
  }))
  const passedIndices = batches
    .filter(({ result }) => result.success)
    .map(({ batchIndex }) => batchIndex)
  const failedIndices = batches
    .filter(({ result }) => !result.success)
    .map(({ batchIndex }) => batchIndex)

  return {
    passed: failedIndices.length === 0,
    batches,
    passedIndices,
    failedIndices,
  }
}
