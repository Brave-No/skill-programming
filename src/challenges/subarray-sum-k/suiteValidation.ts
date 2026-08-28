import type { ArchiveBatch } from './cases'
import { interpretArchiveProgram, type ArchiveInterpretationResult } from './interpreter'
import type { ArchiveSkillNode } from './model'

export interface ArchiveBatchCheck {
  batchIndex: number
  batch: ArchiveBatch
  result: ArchiveInterpretationResult
  passed: boolean
}

export interface ArchiveSuiteCheck {
  passed: boolean
  passedIndices: number[]
  failedIndices: number[]
  batches: ArchiveBatchCheck[]
}

export const checkArchiveBatches = (
  program: ArchiveSkillNode[],
  batches: ArchiveBatch[],
): ArchiveSuiteCheck => {
  const checks = batches.map((batch, batchIndex) => {
    const result = interpretArchiveProgram(program, batch.values, batch.target)
    return { batchIndex, batch, result, passed: result.success && result.answer === batch.expected }
  })
  return {
    passed: checks.every((check) => check.passed),
    passedIndices: checks.filter((check) => check.passed).map((check) => check.batchIndex),
    failedIndices: checks.filter((check) => !check.passed).map((check) => check.batchIndex),
    batches: checks,
  }
}
