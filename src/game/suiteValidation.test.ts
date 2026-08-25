import { describe, expect, it } from 'vitest'
import { RAIN_WATER_BATCHES } from '../challenges/trapping-rain-water/cases'
import {
  createCorrectRainWaterProgram,
  createStalledRainWaterProgram,
} from '../challenges/trapping-rain-water/qaFixtures'
import { checkAllBatches } from './suiteValidation'

describe('checkAllBatches', () => {
  it('passes every formal batch without changing the current program', () => {
    const program = createCorrectRainWaterProgram()
    const before = JSON.stringify(program)
    const result = checkAllBatches(program, RAIN_WATER_BATCHES)

    expect(result.passed).toBe(true)
    expect(result.passedIndices).toEqual([0, 1, 2])
    expect(result.failedIndices).toEqual([])
    expect(JSON.stringify(program)).toBe(before)
  })

  it('keeps failed batch results available for step-by-step inspection', () => {
    const result = checkAllBatches(createStalledRainWaterProgram(), RAIN_WATER_BATCHES)

    expect(result.passed).toBe(false)
    expect(result.failedIndices).toEqual([0, 1, 2])
    expect(result.batches[0].result.error).toContain('还没有向内移动')
    expect(result.batches[0].result.frames.length).toBeGreaterThan(1)
  })
})
