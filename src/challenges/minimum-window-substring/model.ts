export type MinimumWindowSkillType =
  | 'initialize-window'
  | 'scan-source'
  | 'read-incoming-character'
  | 'shrink-covered-window'
  | 'save-best-window'
  | 'read-outgoing-character'

export interface MinimumWindowSkillNode {
  id: string
  type: MinimumWindowSkillType
  children: MinimumWindowSkillNode[]
}

export interface MinimumWindowSkillDefinition {
  type: MinimumWindowSkillType
  label: string
  shortLabel: string
  description: string
  tone: 'yellow' | 'ink' | 'teal' | 'coral' | 'steel'
  createsScope: boolean
  conceptIds: string[]
}

export interface MinimumWindowNeedEntry {
  code: number
  character: string
  balance: number
}

export type MinimumWindowFrameStatus = 'idle' | 'running' | 'success' | 'error'

export interface MinimumWindowTraceFrame {
  id: number
  source: string
  target: string
  targetIndex: number
  left: number
  right: number
  incomingCode: number | null
  outgoingCode: number | null
  missing: number
  bestStart: number | null
  bestLength: number | null
  needEntries: MinimumWindowNeedEntry[]
  changedCode: number | null
  activeNodeId: string | null
  message: string
  status: MinimumWindowFrameStatus
}

export interface MinimumWindowInterpretationResult {
  frames: MinimumWindowTraceFrame[]
  result: string
  bestStart: number | null
  bestLength: number | null
  success: boolean
  error?: string
}

export const MINIMUM_WINDOW_SKILLS: MinimumWindowSkillDefinition[] = [
  {
    type: 'initialize-window',
    label: '建立目标欠账',
    shortLabel: '建立欠账',
    description: '清空窗口状态，并把目标字符串逐字登记到欠账表',
    tone: 'yellow', createsScope: false,
    conceptIds: ['need-table', 'missing-count', 'target-index', 'left-boundary', 'right-boundary', 'best-window', 'target-text', 'target-registration', 'target-character', 'string-length', 'string-char-at'],
  },
  {
    type: 'scan-source',
    label: '向右扩张窗口',
    shortLabel: '向右扩张',
    description: '右边界逐字前进，每轮先纳入字符，再尝试收缩',
    tone: 'ink', createsScope: true,
    conceptIds: ['source-text', 'right-boundary', 'source-scan', 'string-length'],
  },
  {
    type: 'read-incoming-character',
    label: '纳入右侧字符',
    shortLabel: '纳入右字符',
    description: '读取右侧字符，补齐总欠账并更新它的字符余额',
    tone: 'teal', createsScope: false,
    conceptIds: ['source-text', 'right-boundary', 'incoming-character', 'string-char-at', 'need-table', 'incoming-needed', 'missing-count', 'incoming-debit'],
  },
  {
    type: 'shrink-covered-window',
    label: '覆盖后持续收缩',
    shortLabel: '覆盖后收缩',
    description: '总欠账为零时，反复尝试从左侧缩短窗口',
    tone: 'ink', createsScope: true,
    conceptIds: ['missing-count', 'window-covered', 'left-boundary', 'right-boundary'],
  },
  {
    type: 'save-best-window',
    label: '记录更短窗口',
    shortLabel: '记录更短',
    description: '比较当前宽度，只有更短时才更新历史窗口',
    tone: 'yellow', createsScope: false,
    conceptIds: ['left-boundary', 'right-boundary', 'window-length', 'best-window', 'shorter-decision'],
  },
  {
    type: 'read-outgoing-character',
    label: '移出左侧字符',
    shortLabel: '移出左字符',
    description: '读取并移出左字符，恢复欠账后推进左边界',
    tone: 'coral', createsScope: false,
    conceptIds: ['source-text', 'left-boundary', 'outgoing-character', 'string-char-at', 'need-table', 'outgoing-credit', 'restored-debt', 'missing-count'],
  },
]

let sequence = 0

export const createMinimumWindowSkillNode = (
  type: MinimumWindowSkillType,
  id?: string,
): MinimumWindowSkillNode => {
  sequence += 1
  return {
    id: id ?? `minimum-window-${Date.now().toString(36)}-${sequence.toString(36)}`,
    type,
    children: [],
  }
}

export const getMinimumWindowSkill = (type: MinimumWindowSkillType) =>
  MINIMUM_WINDOW_SKILLS.find((skill) => skill.type === type)!

export const findMinimumWindowNode = (
  nodes: MinimumWindowSkillNode[],
  id: string,
): MinimumWindowSkillNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    const nested = findMinimumWindowNode(node.children, id)
    if (nested) return nested
  }
  return null
}

export const containsMinimumWindowNode = (
  node: MinimumWindowSkillNode,
  id: string,
): boolean => node.id === id || node.children.some((child) => containsMinimumWindowNode(child, id))

export const insertMinimumWindowNode = (
  nodes: MinimumWindowSkillNode[],
  scopeId: string,
  index: number,
  node: MinimumWindowSkillNode,
): MinimumWindowSkillNode[] => {
  if (scopeId === 'root') {
    const next = [...nodes]
    next.splice(index, 0, node)
    return next
  }
  return nodes.map((current) => current.id === scopeId
    ? { ...current, children: insertMinimumWindowNode(current.children, 'root', index, node) }
    : { ...current, children: insertMinimumWindowNode(current.children, scopeId, index, node) })
}

export const removeMinimumWindowNode = (
  nodes: MinimumWindowSkillNode[],
  id: string,
): { nodes: MinimumWindowSkillNode[]; removed: MinimumWindowSkillNode | null } => {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) {
    return {
      nodes: nodes.filter((_, currentIndex) => currentIndex !== index),
      removed: nodes[index],
    }
  }
  let removed: MinimumWindowSkillNode | null = null
  const next = nodes.map((node) => {
    if (removed) return node
    const result = removeMinimumWindowNode(node.children, id)
    if (!result.removed) return node
    removed = result.removed
    return { ...node, children: result.nodes }
  })
  return { nodes: next, removed }
}
