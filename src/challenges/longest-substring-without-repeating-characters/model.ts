export type WindowSkillType =
  | 'initialize'
  | 'scan'
  | 'shrink-duplicates'
  | 'admit-current'
  | 'update-best'

export interface WindowSkillNode {
  id: string
  type: WindowSkillType
  children: WindowSkillNode[]
}

export interface WindowSkillDefinition {
  type: WindowSkillType
  label: string
  shortLabel: string
  description: string
  tone: 'yellow' | 'ink' | 'teal' | 'coral' | 'steel'
  createsScope: boolean
  conceptIds: string[]
}

export type WindowFrameStatus = 'idle' | 'running' | 'success' | 'error'

export interface WindowTraceFrame {
  id: number
  source: string
  left: number
  right: number
  windowEnd: number | null
  currentCode: number | null
  frequencies: Record<string, number>
  bestLength: number
  bestStart: number | null
  bestEnd: number | null
  changedIndex: number | null
  changedCode: number | null
  activeNodeId: string | null
  message: string
  status: WindowFrameStatus
}

export interface WindowInterpretationResult {
  frames: WindowTraceFrame[]
  bestLength: number
  bestStart: number | null
  bestEnd: number | null
  success: boolean
  error?: string
}

export const WINDOW_SKILLS: WindowSkillDefinition[] = [
  {
    type: 'initialize',
    label: '初始化灯廊',
    shortLabel: '初始化',
    description: '让守窗员与巡灯员回到起点，清空频次台和最长记录',
    tone: 'yellow',
    createsScope: false,
    conceptIds: ['left-boundary', 'right-boundary', 'frequency-table', 'best-length'],
  },
  {
    type: 'scan',
    label: '扫描直到末尾',
    shortLabel: '扫描',
    description: '巡灯员尚未走出字符轨道时，逐格读取并重复窗口流程',
    tone: 'ink',
    createsScope: true,
    conceptIds: ['right-boundary', 'scan-boundary', 'string-length'],
  },
  {
    type: 'shrink-duplicates',
    label: '重复时收缩窗口',
    shortLabel: '重复则收缩',
    description: '发现重复后，守窗员持续清退左端字符并收紧边界，直到恢复唯一',
    tone: 'coral',
    createsScope: false,
    conceptIds: ['string-input', 'current-character', 'frequency-table', 'duplicate-decision', 'left-boundary', 'release-left-character', 'move-left-boundary', 'string-char-at'],
  },
  {
    type: 'admit-current',
    label: '纳入当前字符',
    shortLabel: '纳入字符',
    description: '重复消失后，把当前字符频次加一',
    tone: 'teal',
    createsScope: false,
    conceptIds: ['current-character', 'frequency-table', 'admit-current-character'],
  },
  {
    type: 'update-best',
    label: '更新最长记录',
    shortLabel: '更新最长',
    description: '计算当前窗口宽度，并保留历史最大值',
    tone: 'yellow',
    createsScope: false,
    conceptIds: ['left-boundary', 'right-boundary', 'window-width', 'best-length'],
  },
]

let sequence = 0

export const createWindowSkillNode = (
  type: WindowSkillType,
  id?: string,
): WindowSkillNode => {
  sequence += 1
  return {
    id: id ?? `window-skill-${Date.now().toString(36)}-${sequence.toString(36)}`,
    type,
    children: [],
  }
}

export const getWindowSkill = (type: WindowSkillType) =>
  WINDOW_SKILLS.find((skill) => skill.type === type)!
