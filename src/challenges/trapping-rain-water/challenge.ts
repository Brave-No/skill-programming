import type { JavaProgram } from '../../codePractice/javaSubset'
import { SKILL_DEFINITIONS } from '../../game/model'
import type { AlgorithmChallenge } from '../types'
import { RAIN_WATER_BATCHES, RAIN_WATER_CODE_CASES } from './cases'
import { RAIN_WATER_CONCEPTS } from './concepts'
import {
  RAIN_WATER_MAPPINGS,
  RAIN_WATER_REFERENCE_STEPS,
  RAIN_WATER_SCAFFOLD,
} from './reference'
import { analyzeRainWaterProgram } from './semantics'

export const RAIN_WATER_CHALLENGE: AlgorithmChallenge<JavaProgram> = {
  id: 'trapping-rain-water',
  title: '雨线峡谷',
  strategy: {
    id: 'two-pointers',
    label: '双指针',
    summary: '从两端维护已知最高岸线，每轮只结算较低的一侧。',
  },
  languageId: 'java',
  concepts: RAIN_WATER_CONCEPTS,
  scene: {
    observeTerrain: [3, 0, 2, 0, 4],
    target: '找出全部积水',
  },
  manualStage: {
    prompt: '哪些位置会留下水？',
  },
  skills: SKILL_DEFINITIONS,
  automationStage: {
    programContract: {
      initialState: 'empty',
      invalidateVerificationOnEdit: true,
      allowDirectSuiteValidation: true,
    },
    verificationBatches: RAIN_WATER_BATCHES,
  },
  codePractice: {
    methodSignature: 'int trap(int[] height)',
    scaffold: RAIN_WATER_SCAFFOLD,
    referenceSteps: RAIN_WATER_REFERENCE_STEPS,
    mappings: RAIN_WATER_MAPPINGS,
    cases: RAIN_WATER_CODE_CASES,
  },
  validate: analyzeRainWaterProgram,
}
