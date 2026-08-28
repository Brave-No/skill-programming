import {
  parseJavaSubset,
  runJavaSubset,
  type JavaProgram,
} from '../../codePractice/javaSubset'
import { SKILL_DEFINITIONS, type SkillDefinition } from '../../game/model'
import type { AlgorithmChallenge } from '../types'
import { RAIN_WATER_BATCHES, RAIN_WATER_CODE_CASES } from './cases'
import { RAIN_WATER_CONCEPTS } from './concepts'
import {
  RAIN_WATER_MAPPINGS,
  RAIN_WATER_REFERENCE_STEPS,
  RAIN_WATER_SCAFFOLD,
} from './reference'
import { analyzeRainWaterProgram } from './semantics'

export const RAIN_WATER_CHALLENGE: AlgorithmChallenge<
  JavaProgram,
  number[],
  number,
  SkillDefinition
> = {
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
    runtime: {
      parse: parseJavaSubset,
      run: (source, input, expected) => runJavaSubset<number>(source, input, expected),
      formatInput: (input) => JSON.stringify(input),
      formatOutput: (output) => output === undefined ? '未产生返回值' : `${output} 格`,
    },
    presentation: {
      eyebrow: '06 代码实战 · Java',
      title: '把双端巡检写成代码',
      methodBodyLabel: '接雨水方法体',
      dictionaryApiLabel: '数组与 API',
      neutralFreeMessage: '尚未运行当前草稿',
      semanticFallback: '双指针逻辑还没有连通。',
    },
    checkToSlot: {
      deploy: 'preparation',
      patrol: 'loop-condition',
      compare: 'shore-condition',
      leftAdvance: 'left-advance',
      leftUpdateMax: 'left-update-max',
      leftCollect: 'left-collect',
      alternate: 'shore-condition',
      rightAdvance: 'right-advance',
      rightUpdateMax: 'right-update-max',
      rightCollect: 'right-collect',
      scopes: 'shore-condition',
      return: 'result',
    },
    draftStorage: {
      legacyKeys: {
        free: 'rainline:java-free-draft:v1',
        structured: 'rainline:java-structured-draft:v2',
        mode: 'rainline:java-mode:v1',
      },
    },
  },
  validate: analyzeRainWaterProgram,
}
