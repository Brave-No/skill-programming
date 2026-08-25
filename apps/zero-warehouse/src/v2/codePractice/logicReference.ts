import type { SkillType } from '../model'
import { parseJavaSubset } from './javaSubset'
import { analyzeMoveZeroesProgram } from './moveZeroesSemantics'
import type { StructuredSlotId } from './structuredMode'

export type LogicStepRole = 'action' | 'open-scope' | 'close-scope'
export type LogicStepTone = 'yellow' | 'ink' | 'teal' | 'coral' | 'steel'

export interface LogicCodeStep {
  id: string
  order: number
  skillType: SkillType
  skillLabel: string
  worldAction: string
  logicPurpose: string
  role: LogicStepRole
  depth: 0 | 1 | 2
  scopePath: Array<'method' | SkillType>
  tone: LogicStepTone
  code: string
  structuredSlotIds: StructuredSlotId[]
  lockedStructure: boolean
}

export interface LanguageLogicReference {
  languageId: string
  label: string
  methodSignature: string
  steps: LogicCodeStep[]
}

export const JAVA_LOGIC_REFERENCE: LanguageLogicReference = {
  languageId: 'java',
  label: 'Java',
  methodSignature: 'void moveZeroes(int[] nums)',
  steps: [
    {
      id: 'initialize-write-pointer',
      order: 1,
      skillType: 'set-write',
      skillLabel: '定位装载标记',
      worldAction: '装载手停在 0 号货位',
      logicPurpose: '先记住下一个货箱应该落下的位置。',
      role: 'action',
      depth: 0,
      scopePath: ['method'],
      tone: 'yellow',
      code: 'int writeIndex = 0;',
      structuredSlotIds: ['preparation'],
      lockedStructure: false,
    },
    {
      id: 'open-scan-loop',
      order: 2,
      skillType: 'for-each',
      skillLabel: '逐个遍历',
      worldAction: '扫描手依次经过全部货位',
      logicPurpose: '让同一套检查动作覆盖仓库中的每一个位置。',
      role: 'open-scope',
      depth: 0,
      scopePath: ['method'],
      tone: 'ink',
      code: 'for (int scanIndex = 0; scanIndex < nums.length; scanIndex++) {',
      structuredSlotIds: ['loop-init', 'loop-condition', 'loop-update'],
      lockedStructure: true,
    },
    {
      id: 'open-cargo-condition',
      order: 3,
      skillType: 'if-occupied',
      skillLabel: '条件判断',
      worldAction: '只在当前货位有货时继续',
      logicPurpose: '空位不需要装载，把搬运动作限制在有货的情况里。',
      role: 'open-scope',
      depth: 1,
      scopePath: ['method', 'for-each'],
      tone: 'teal',
      code: '  if (nums[scanIndex] != 0) {',
      structuredSlotIds: ['occupied-condition'],
      lockedStructure: true,
    },
    {
      id: 'swap-cargo',
      order: 4,
      skillType: 'swap',
      skillLabel: '交换位置',
      worldAction: '扫描手取箱，装载手接箱落位',
      logicPurpose: '用临时变量保住货箱，再交换扫描位和装载位。',
      role: 'action',
      depth: 2,
      scopePath: ['method', 'for-each', 'if-occupied'],
      tone: 'coral',
      code: `    int temp = nums[scanIndex];
    nums[scanIndex] = nums[writeIndex];
    nums[writeIndex] = temp;`,
      structuredSlotIds: ['swap'],
      lockedStructure: false,
    },
    {
      id: 'advance-write-pointer',
      order: 5,
      skillType: 'advance-write',
      skillLabel: '移动装载标记',
      worldAction: '装载手在落货后前进一步',
      logicPurpose: '当前装载位已占用，下一箱应落到后一格。',
      role: 'action',
      depth: 2,
      scopePath: ['method', 'for-each', 'if-occupied'],
      tone: 'steel',
      code: '    writeIndex++;',
      structuredSlotIds: ['slow-update'],
      lockedStructure: false,
    },
    {
      id: 'close-cargo-condition',
      order: 6,
      skillType: 'if-occupied',
      skillLabel: '结束条件判断',
      worldAction: '结束当前货位的有货动作',
      logicPurpose: '这条边界收住只在有货时执行的交换与前进。',
      role: 'close-scope',
      depth: 1,
      scopePath: ['method', 'for-each', 'if-occupied'],
      tone: 'teal',
      code: '  }',
      structuredSlotIds: [],
      lockedStructure: true,
    },
    {
      id: 'close-scan-loop',
      order: 7,
      skillType: 'for-each',
      skillLabel: '结束逐个遍历',
      worldAction: '扫描手完成全部货位',
      logicPurpose: '这条边界结束整轮仓库扫描。',
      role: 'close-scope',
      depth: 0,
      scopePath: ['method', 'for-each'],
      tone: 'ink',
      code: '}',
      structuredSlotIds: [],
      lockedStructure: true,
    },
  ],
}

export const composeLogicBody = (reference: LanguageLogicReference) =>
  reference.steps.map((step) => step.code).join('\n')

export const analyzeLogicStepProgress = (
  source: string,
  reference: LanguageLogicReference = JAVA_LOGIC_REFERENCE,
) => {
  const progress = new Map(reference.steps.map((step) => [step.id, false]))
  if (!source.trim()) return progress

  try {
    const { checks } = analyzeMoveZeroesProgram(parseJavaSubset(source))
    const semanticProgress: Record<string, boolean> = {
      'initialize-write-pointer': checks.preparation,
      'open-scan-loop': checks.forScope && checks.loopInit && checks.loopCondition && checks.loopUpdate,
      'open-cargo-condition': checks.ifScope && checks.occupiedCondition,
      'swap-cargo': checks.swap,
      'advance-write-pointer': checks.slowUpdate,
      'close-cargo-condition': checks.ifScope,
      'close-scan-loop': checks.forScope,
    }
    for (const step of reference.steps) {
      progress.set(step.id, semanticProgress[step.id] ?? false)
    }
  } catch {
    return progress
  }

  return progress
}
