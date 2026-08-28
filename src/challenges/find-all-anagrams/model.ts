export type AnagramSkillType =
  | 'prepare'
  | 'scan-source'
  | 'add-incoming'
  | 'if-overflow'
  | 'if-match'

export interface AnagramSkillNode {
  id: string
  type: AnagramSkillType
  children: AnagramSkillNode[]
}

export interface AnagramSkillDefinition {
  type: AnagramSkillType
  label: string
  shortLabel: string
  description: string
  tone: 'yellow' | 'ink' | 'teal' | 'coral' | 'steel'
  createsScope: boolean
  conceptIds: string[]
}

export type AnagramFrameStatus = 'idle' | 'running' | 'success' | 'error'

export interface AnagramTraceFrame {
  id: number
  source: string
  pattern: string
  targetCounts: number[]
  windowCounts: number[]
  left: number
  right: number | null
  patternIndex: number | null
  activeChar: string | null
  enteringIndex: number | null
  leavingIndex: number | null
  matches: number[]
  frequenciesMatch: boolean
  overflow: boolean
  activeNodeId: string | null
  message: string
  status: AnagramFrameStatus
}

export interface AnagramInterpretationResult {
  frames: AnagramTraceFrame[]
  matches: number[]
  success: boolean
  error?: string
}

export interface AnagramProgramIssue {
  nodeId: string | null
  message: string
}

export interface AnagramProgramValidation {
  valid: boolean
  issue?: AnagramProgramIssue
}

export const ANAGRAM_SKILLS: AnagramSkillDefinition[] = [
  {
    type: 'prepare',
    label: '建立目标频谱',
    shortLabel: '目标频谱',
    description: '清空状态，并把目标字符串逐字累计到目标频谱',
    tone: 'yellow',
    createsScope: false,
    conceptIds: ['pattern-string', 'pattern-index', 'pattern-boundary', 'target-counts', 'window-counts', 'left-index', 'result-indices', 'alphabet-offset', 'string-char-at'],
  },
  {
    type: 'scan-source',
    label: '向右扫描源信号',
    shortLabel: '扫描源串',
    description: '右探针逐字前进，并重复执行窗口维护规则',
    tone: 'ink',
    createsScope: true,
    conceptIds: ['source-string', 'right-index', 'source-boundary'],
  },
  {
    type: 'add-incoming',
    label: '纳入右侧字母',
    shortLabel: '右侧 +1',
    description: '把右探针读到的字母加入窗口频谱',
    tone: 'coral',
    createsScope: false,
    conceptIds: ['window-counts', 'incoming-count', 'alphabet-offset', 'string-char-at'],
  },
  {
    type: 'if-overflow',
    label: '超宽时收缩左侧',
    shortLabel: '超宽则收缩',
    description: '窗口超过目标长度时，移出左字符并推进左边界',
    tone: 'steel',
    createsScope: false,
    conceptIds: ['window-width', 'overflow-decision', 'string-length', 'window-counts', 'outgoing-count', 'left-index', 'left-advance', 'string-char-at'],
  },
  {
    type: 'if-match',
    label: '匹配时记录起点',
    shortLabel: '匹配则记录',
    description: '固定宽度窗口与目标频谱一致时，记录当前左边界',
    tone: 'teal',
    createsScope: false,
    conceptIds: ['window-width', 'frequency-equality', 'arrays-equals', 'left-index', 'result-indices', 'record-index', 'list-add'],
  },
]

let nodeSequence = 0

export const createAnagramSkillNode = (
  type: AnagramSkillType,
  id?: string,
): AnagramSkillNode => {
  nodeSequence += 1
  return {
    id: id ?? `anagram-skill-${Date.now().toString(36)}-${nodeSequence.toString(36)}`,
    type,
    children: [],
  }
}

export const getAnagramSkill = (type: AnagramSkillType) =>
  ANAGRAM_SKILLS.find((definition) => definition.type === type)!

const isType = (node: AnagramSkillNode | undefined, type: AnagramSkillType) =>
  node?.type === type

export const validateAnagramSkillProgram = (
  program: AnagramSkillNode[],
): AnagramProgramValidation => {
  if (program.length === 0) {
    return { valid: false, issue: { nodeId: null, message: '规则区是空的。' } }
  }

  const [prepare, sourceLoop] = program
  if (!isType(prepare, 'prepare')) {
    return { valid: false, issue: { nodeId: prepare?.id ?? null, message: '主流程第一步需要先建立目标频谱。' } }
  }
  if (!isType(sourceLoop, 'scan-source') || program.length !== 2) {
    return { valid: false, issue: { nodeId: sourceLoop?.id ?? null, message: '目标频谱完成后，需要扫描源字符串。' } }
  }

  const [add, overflow, match] = sourceLoop.children
  if (!isType(add, 'add-incoming')) {
    return { valid: false, issue: { nodeId: add?.id ?? sourceLoop.id, message: '源串每轮需要先纳入右探针读到的字母。' } }
  }
  if (!isType(overflow, 'if-overflow')) {
    return { valid: false, issue: { nodeId: overflow?.id ?? sourceLoop.id, message: '纳入字母后需要判断窗口是否超宽。' } }
  }
  if (overflow.children.length !== 0) {
    return { valid: false, issue: { nodeId: overflow.id, message: '“超宽则收缩”已经包含移出字符与推进左边界，不需要再嵌套技能。' } }
  }
  if (!isType(match, 'if-match') || sourceLoop.children.length !== 3) {
    return { valid: false, issue: { nodeId: match?.id ?? sourceLoop.id, message: '窗口收缩完成后需要判断两份频谱是否一致。' } }
  }
  if (match.children.length !== 0) {
    return { valid: false, issue: { nodeId: match.id, message: '“匹配则记录”已经包含记录起点，不需要再嵌套技能。' } }
  }

  return { valid: true }
}
