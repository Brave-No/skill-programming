import { calculateWater } from '../../game/interpreter'
import type { CodePracticeCase, VerificationBatch } from '../types'

const totalWater = (terrain: number[]) =>
  calculateWater(terrain).reduce((total, depth) => total + depth, 0)

export const RAIN_WATER_BATCHES: VerificationBatch[] = [
  { id: 'north-slope', name: '北坡断面', terrain: [4, 2, 0, 6, 2, 5], expectedTotal: 9 },
  { id: 'old-channel', name: '旧渠断面', terrain: [3, 0, 1, 3, 0, 5], expectedTotal: 8 },
  { id: 'twin-peaks', name: '双峰断面', terrain: [5, 2, 1, 2, 1, 5], expectedTotal: 14 },
]

const hiddenTerrains = [
  [],
  [2],
  [1, 2, 3, 4],
  [4, 3, 2, 1],
  [2, 0, 2],
  [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1],
  [5, 4, 1, 2],
]

export const RAIN_WATER_CODE_CASES: CodePracticeCase[] = [
  ...RAIN_WATER_BATCHES.map((batch, index) => ({
    id: `public-${index + 1}`,
    label: `公开断面 ${index + 1}`,
    input: batch.terrain,
    expected: batch.expectedTotal,
    visibility: 'public' as const,
  })),
  ...hiddenTerrains.map((terrain, index) => ({
    id: `hidden-${index + 1}`,
    label: '隐藏断面',
    input: terrain,
    expected: totalWater(terrain),
    visibility: 'hidden' as const,
  })),
]

export const PUBLIC_RAIN_WATER_CODE_CASES = RAIN_WATER_CODE_CASES.filter(
  (testCase) => testCase.visibility === 'public',
)
