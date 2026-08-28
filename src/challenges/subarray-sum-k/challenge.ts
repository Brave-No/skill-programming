import {
  parseJavaSubset,
  runJavaSubset,
  type JavaProgram,
} from '../../codePractice/javaSubset'
import type { AlgorithmChallenge } from '../types'
import {
  ARCHIVE_BATCHES,
  ARCHIVE_CODE_CASES,
  type ArchiveBatch,
  type ArchiveCodeInput,
} from './cases'
import { ARCHIVE_CONCEPTS } from './concepts'
import { ARCHIVE_SKILLS, type ArchiveSkillDefinition } from './model'
import {
  ARCHIVE_MAPPINGS,
  ARCHIVE_REFERENCE_STEPS,
  ARCHIVE_SCAFFOLD,
} from './reference'
import { analyzeArchiveJavaProgram } from './semantics'

export interface ArchiveSceneSpec {
  target: string
  observeValues: number[]
  observeTarget: number
}

export const SUBARRAY_SUM_K_CHALLENGE: AlgorithmChallenge<
  JavaProgram,
  ArchiveCodeInput,
  number,
  ArchiveSkillDefinition,
  ArchiveBatch,
  ArchiveSceneSpec
> = {
  id: 'subarray-sum-k',
  title: '前缀和档案站',
  strategy: {
    id: 'prefix-sum-frequency',
    label: '前缀和 + 频次表',
    summary: '用当前前缀反查目标旧前缀，并按历史出现次数累加连续区间。',
  },
  languageId: 'java',
  concepts: ARCHIVE_CONCEPTS,
  scene: {
    target: '找出全部和为 K 的连续子数组',
    observeValues: [1, 1, 1],
    observeTarget: 2,
  },
  manualStage: {
    prompt: '在数值带上找齐两个和为 2 的连续区间。',
  },
  skills: ARCHIVE_SKILLS,
  automationStage: {
    programContract: {
      initialState: 'empty',
      invalidateVerificationOnEdit: true,
      allowDirectSuiteValidation: true,
    },
    verificationBatches: ARCHIVE_BATCHES,
  },
  codePractice: {
    methodSignature: 'int subarraySum(int[] nums, int k)',
    scaffold: ARCHIVE_SCAFFOLD,
    referenceSteps: ARCHIVE_REFERENCE_STEPS,
    mappings: ARCHIVE_MAPPINGS,
    cases: ARCHIVE_CODE_CASES,
    runtime: {
      parse: parseJavaSubset,
      run: (source, input, expected) => runJavaSubset(
        source,
        { nums: input.nums, k: input.k },
        expected,
      ),
      formatInput: (input) => `nums = ${JSON.stringify(input.nums)}, k = ${input.k}`,
      formatOutput: (output) => output === undefined ? '未产生返回值' : `${output} 个`,
    },
    presentation: {
      eyebrow: '06 代码实战 · Java',
      title: '把前缀档案规则写成代码',
      methodBodyLabel: '和为 K 的子数组方法体',
      dictionaryApiLabel: 'Map 与数组 API',
      neutralFreeMessage: '尚未运行当前草稿',
      semanticFallback: '前缀和与频次档案的因果链还没有连通。',
    },
    checkToSlot: {
      archive: 'archive-setup',
      state: 'state-setup',
      scan: 'loop-condition',
      prefixUpdate: 'prefix-update',
      needed: 'needed',
      count: 'count',
      record: 'record',
      advance: 'advance',
      scope: 'loop-condition',
      result: 'result',
    },
  },
  validate: analyzeArchiveJavaProgram,
}
