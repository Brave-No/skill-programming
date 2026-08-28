import {
  parseJavaSubset,
  runJavaSubset,
  type JavaProgram,
} from '../../codePractice/javaSubset'
import type { AlgorithmChallenge } from '../types'
import { WINDOW_BATCHES, WINDOW_CODE_CASES, type WindowVerificationBatch } from './cases'
import { LONGEST_SUBSTRING_CONCEPTS } from './concepts'
import { WINDOW_SKILLS, type WindowSkillDefinition } from './model'
import {
  LONGEST_SUBSTRING_MAPPINGS,
  LONGEST_SUBSTRING_REFERENCE_STEPS,
  LONGEST_SUBSTRING_SCAFFOLD,
} from './reference'
import { analyzeLongestSubstringProgram } from './semantics'

interface CharacterCorridorScene {
  source: string
  target: string
}

export const LONGEST_SUBSTRING_CHALLENGE: AlgorithmChallenge<
  JavaProgram,
  string,
  number,
  WindowSkillDefinition,
  WindowVerificationBatch,
  CharacterCorridorScene
> = {
  id: 'longest-substring-without-repeating-characters',
  title: '字符灯廊',
  strategy: {
    id: 'sliding-window',
    label: '滑动窗口',
    summary: '巡灯员逐字读取；发现重复时守窗员持续收紧左边界，始终维持一个无重复连续窗口。',
  },
  languageId: 'java',
  concepts: LONGEST_SUBSTRING_CONCEPTS,
  scene: {
    source: 'abba',
    target: '选出最长无重复连续窗口',
  },
  manualStage: {
    prompt: '在字符轨道上选择一段最长、连续且没有重复字符的窗口。',
  },
  skills: WINDOW_SKILLS,
  automationStage: {
    programContract: {
      initialState: 'empty',
      invalidateVerificationOnEdit: true,
      allowDirectSuiteValidation: true,
    },
    verificationBatches: WINDOW_BATCHES,
  },
  codePractice: {
    methodSignature: 'int lengthOfLongestSubstring(String s)',
    scaffold: LONGEST_SUBSTRING_SCAFFOLD,
    referenceSteps: LONGEST_SUBSTRING_REFERENCE_STEPS,
    mappings: LONGEST_SUBSTRING_MAPPINGS,
    cases: WINDOW_CODE_CASES,
    runtime: {
      parse: parseJavaSubset,
      run: (source, input, expected) => runJavaSubset<number>(source, { s: input }, expected),
      formatInput: (input) => JSON.stringify(input),
      formatOutput: (output) => output === undefined ? '未产生返回值' : `${output} 个字符`,
    },
    presentation: {
      eyebrow: '06 代码实战 · Java',
      title: '把无重复窗口写成代码',
      methodBodyLabel: '最长无重复子串方法体',
      dictionaryApiLabel: '字符串、数组与 API',
      neutralFreeMessage: '结构、语义与当前字符带已通过',
      semanticFallback: '滑动窗口的因果顺序还没有连通。',
    },
    checkToSlot: {
      initialize: 'preparation',
      scan: 'scan-condition',
      readCurrent: 'read-current',
      duplicate: 'duplicate-condition',
      release: 'release-left',
      moveLeft: 'advance-left',
      admit: 'admit-current',
      updateBest: 'update-best',
      moveRight: 'advance-right',
      scopes: 'duplicate-condition',
      return: 'result',
    },
  },
  validate: analyzeLongestSubstringProgram,
}
