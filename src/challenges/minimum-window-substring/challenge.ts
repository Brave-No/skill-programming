import { parseJavaSubset, runJavaSubset, type JavaProgram } from '../../codePractice/javaSubset'
import type { AlgorithmChallenge } from '../types'
import {
  MINIMUM_WINDOW_BATCHES,
  MINIMUM_WINDOW_CODE_CASES,
  type MinimumWindowInput,
  type MinimumWindowVerificationBatch,
} from './cases'
import { MINIMUM_WINDOW_CONCEPTS } from './concepts'
import { MINIMUM_WINDOW_SKILLS, type MinimumWindowSkillDefinition } from './model'
import {
  MINIMUM_WINDOW_MAPPINGS,
  MINIMUM_WINDOW_REFERENCE_STEPS,
  MINIMUM_WINDOW_SCAFFOLD,
} from './reference'
import { analyzeMinimumWindowProgram } from './semantics'

interface MinimumWindowScene {
  source: string
  target: string
  objective: string
}

export const MINIMUM_WINDOW_CHALLENGE: AlgorithmChallenge<
  JavaProgram,
  MinimumWindowInput,
  string,
  MinimumWindowSkillDefinition,
  MinimumWindowVerificationBatch,
  MinimumWindowScene
> = {
  id: 'minimum-window-substring',
  title: '窗口校准台',
  strategy: {
    id: 'variable-sliding-window',
    label: '可变滑动窗口',
    summary: '右侧补齐字符欠账，完整覆盖后从左侧持续收缩，并封存历史最短窗口。',
  },
  languageId: 'java',
  concepts: MINIMUM_WINDOW_CONCEPTS,
  scene: {
    source: 'ADOBECODEBANC',
    target: 'ABC',
    objective: '锁定最短完整片段',
  },
  manualStage: {
    prompt: '框出一段连续文字，使它覆盖需求卡的全部字符，并且长度尽可能短。',
  },
  skills: MINIMUM_WINDOW_SKILLS,
  automationStage: {
    programContract: {
      initialState: 'empty',
      invalidateVerificationOnEdit: true,
      allowDirectSuiteValidation: true,
    },
    verificationBatches: MINIMUM_WINDOW_BATCHES,
  },
  codePractice: {
    methodSignature: 'String minWindow(String s, String t)',
    scaffold: MINIMUM_WINDOW_SCAFFOLD,
    referenceSteps: MINIMUM_WINDOW_REFERENCE_STEPS,
    mappings: MINIMUM_WINDOW_MAPPINGS,
    cases: MINIMUM_WINDOW_CODE_CASES,
    runtime: {
      parse: parseJavaSubset,
      run: (source, input, expected) => runJavaSubset<string>(
        source,
        { s: input.source, t: input.target },
        expected,
      ),
      formatInput: (input) => `s = ${JSON.stringify(input.source)}, t = ${JSON.stringify(input.target)}`,
      formatOutput: (output) => output === undefined ? '未产生返回值' : JSON.stringify(output),
    },
    presentation: {
      eyebrow: '06 代码实战 · Java',
      title: '把欠账窗口写成代码',
      methodBodyLabel: '最小覆盖子串方法体',
      dictionaryApiLabel: '字符串、计数数组与 API',
      neutralFreeMessage: '写入方法体后，可以检查窗口语义并运行真实文字带。',
      semanticFallback: '目标登记、入窗补齐或覆盖收缩的因果顺序还没有连通。',
    },
    checkToSlot: {
      initialize: 'target-preparation',
      targetLoop: 'target-condition',
      readTarget: 'read-target',
      addTargetDebt: 'add-target-debt',
      advanceTarget: 'advance-target',
      prepareWindow: 'window-preparation',
      sourceLoop: 'scan-condition',
      readIncoming: 'read-incoming',
      incomingCheck: 'incoming-debt-condition',
      reduceMissing: 'reduce-missing',
      debitIncoming: 'debit-incoming',
      shrinkLoop: 'shrink-condition',
      measureWindow: 'measure-window',
      shorterCheck: 'shorter-condition',
      saveBest: 'save-best',
      readOutgoing: 'read-outgoing',
      creditOutgoing: 'credit-outgoing',
      restoreCheck: 'restored-condition',
      increaseMissing: 'increase-missing',
      advanceLeft: 'advance-left',
      advanceRight: 'advance-right',
      scopes: 'shrink-condition',
      emptyResult: 'no-answer-condition',
      returnWindow: 'window-result',
    },
  },
  validate: analyzeMinimumWindowProgram,
}
