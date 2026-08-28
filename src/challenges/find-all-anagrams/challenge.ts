import {
  parseJavaSubset,
  runJavaSubset,
  type JavaProgram,
} from '../../codePractice/javaSubset'
import type {
  AlgorithmChallenge,
  CodePracticeRunResult,
} from '../types'
import { ANAGRAM_BATCHES, ANAGRAM_CODE_CASES, type AnagramInput, type AnagramVerificationBatch } from './cases'
import { ANAGRAM_CONCEPTS } from './concepts'
import { ANAGRAM_SKILLS, type AnagramSkillDefinition } from './model'
import {
  ANAGRAM_MAPPINGS,
  ANAGRAM_REFERENCE_STEPS,
  ANAGRAM_SCAFFOLD,
} from './reference'
import { analyzeAnagramProgram } from './semantics'

export const ANAGRAM_CHALLENGE: AlgorithmChallenge<
  JavaProgram,
  AnagramInput,
  number[],
  AnagramSkillDefinition,
  AnagramVerificationBatch
> = {
  id: 'find-all-anagrams',
  title: '频谱滑窗站',
  strategy: {
    id: 'fixed-sliding-window',
    label: '固定长度滑动窗口',
    summary: '持续维护一个与目标等宽的字母频谱窗口，逐格相等时记录左边界。',
  },
  languageId: 'java',
  concepts: ANAGRAM_CONCEPTS,
  scene: {
    observeTerrain: [],
    target: '找出全部异位词窗口起点',
  },
  manualStage: {
    prompt: '哪些固定宽度窗口与目标卡拥有相同字母频谱？',
  },
  skills: ANAGRAM_SKILLS,
  automationStage: {
    programContract: {
      initialState: 'empty',
      invalidateVerificationOnEdit: true,
      allowDirectSuiteValidation: true,
    },
    verificationBatches: ANAGRAM_BATCHES,
  },
  codePractice: {
    methodSignature: 'List<Integer> findAnagrams(String s, String p)',
    scaffold: ANAGRAM_SCAFFOLD,
    referenceSteps: ANAGRAM_REFERENCE_STEPS,
    mappings: ANAGRAM_MAPPINGS,
    cases: ANAGRAM_CODE_CASES,
    runtime: {
      parse: parseJavaSubset,
      run: (source, input, expected) => runJavaSubset<number[]>(
        source,
        { s: input.source, p: input.pattern },
        expected,
      ) as CodePracticeRunResult<number[]>,
      formatInput: ({ source, pattern }) => `s = "${source}", p = "${pattern}"`,
      formatOutput: (output) => output === undefined ? '未产生返回值' : `[${output.join(', ')}]`,
    },
    presentation: {
      eyebrow: '06 代码实战 · Java',
      title: '把频谱滑窗写成代码',
      methodBodyLabel: '异位词扫描方法体',
      dictionaryApiLabel: '字符串、数组与 List API',
      neutralFreeMessage: '尚未运行当前异位词扫描草稿',
      semanticFallback: '固定窗口的频谱维护还没有连通。',
    },
    checkToSlot: {
      initialize: 'preparation',
      patternLoop: 'pattern-loop-condition',
      targetCount: 'target-count',
      patternScope: 'target-count',
      sourceLoop: 'source-loop-condition',
      addIncoming: 'add-incoming',
      overflowCondition: 'overflow-condition',
      removeOutgoing: 'remove-outgoing',
      leftAdvance: 'advance-left',
      matchCondition: 'match-condition',
      recordIndex: 'record-index',
      scopes: 'overflow-condition',
      returnResult: 'result',
    },
  },
  validate: analyzeAnagramProgram,
}
