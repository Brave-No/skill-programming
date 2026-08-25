export type SkillType =
  | 'deploy'
  | 'patrol'
  | 'compare'
  | 'advance'
  | 'update-max'
  | 'collect'

export interface SkillNode {
  id: string
  type: SkillType
  children: SkillNode[]
}

export type ScoutSide = 'left' | 'right'
export type FrameStatus = 'idle' | 'running' | 'success' | 'error'

export interface TraceFrame {
  id: number
  terrain: number[]
  water: number[]
  left: number | null
  right: number | null
  leftMax: number
  rightMax: number
  leftMaxIndex: number | null
  rightMaxIndex: number | null
  selectedSide: ScoutSide | null
  activeNodeId: string | null
  changedIndex: number | null
  totalWater: number
  message: string
  status: FrameStatus
}

export interface InterpretationResult {
  frames: TraceFrame[]
  water: number[]
  totalWater: number
  success: boolean
  error?: string
}

export interface SkillDefinition {
  type: SkillType
  label: string
  shortLabel: string
  description: string
  tone: 'yellow' | 'ink' | 'teal' | 'coral' | 'steel'
  createsScope: boolean
  conceptIds: string[]
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    type: 'deploy',
    label: '双端就位',
    shortLabel: '就位',
    description: '站到地形两端，并读取两侧起始岸线',
    tone: 'yellow',
    createsScope: false,
    conceptIds: ['left-position', 'right-position', 'left-maximum', 'right-maximum'],
  },
  {
    type: 'patrol',
    label: '巡检直到相遇',
    shortLabel: '巡检',
    description: '反复执行内部技能，直到两名巡线员错身',
    tone: 'ink',
    createsScope: true,
    conceptIds: ['patrol-boundary'],
  },
  {
    type: 'compare',
    label: '选择较低岸线',
    shortLabel: '选低岸',
    description: '比较两边已见过的最高岸线',
    tone: 'teal',
    createsScope: false,
    conceptIds: ['left-maximum', 'right-maximum', 'lower-shore-decision'],
  },
  {
    type: 'advance',
    label: '低岸向内一步',
    shortLabel: '向内',
    description: '让当前较低的一侧先向峡谷内部移动',
    tone: 'steel',
    createsScope: false,
    conceptIds: ['left-position', 'right-position', 'advance-selected-shore'],
  },
  {
    type: 'update-max',
    label: '更新最高柱',
    shortLabel: '更新最高',
    description: '比较旧记录和当前柱高，记住本侧迄今最高的柱子',
    tone: 'yellow',
    createsScope: false,
    conceptIds: ['left-maximum', 'right-maximum', 'maximum-update', 'math-max'],
  },
  {
    type: 'collect',
    label: '计算当前积水',
    shortLabel: '算水深',
    description: '用本侧最高柱减去当前柱高，并把结果计入总量',
    tone: 'coral',
    createsScope: false,
    conceptIds: ['left-maximum', 'right-maximum', 'water-depth', 'water-total'],
  },
]

let sequence = 0

export const createSkillNode = (type: SkillType, id?: string): SkillNode => {
  sequence += 1
  return {
    id: id ?? `rain-skill-${Date.now().toString(36)}-${sequence.toString(36)}`,
    type,
    children: [],
  }
}

export const getSkillDefinition = (type: SkillType) =>
  SKILL_DEFINITIONS.find((definition) => definition.type === type)!

export const findNode = (nodes: SkillNode[], id: string): SkillNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    const nested = findNode(node.children, id)
    if (nested) return nested
  }
  return null
}

export const removeNode = (
  nodes: SkillNode[],
  id: string,
): { nodes: SkillNode[]; removed: SkillNode | null } => {
  let removed: SkillNode | null = null
  const next: SkillNode[] = []

  for (const node of nodes) {
    if (node.id === id) {
      removed = node
      continue
    }
    const childResult = removeNode(node.children, id)
    if (childResult.removed) removed = childResult.removed
    next.push({ ...node, children: childResult.nodes })
  }

  return { nodes: next, removed }
}

export const insertNode = (
  nodes: SkillNode[],
  scopeId: string,
  index: number,
  node: SkillNode,
): SkillNode[] => {
  if (scopeId === 'root') {
    const next = [...nodes]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node)
    return next
  }

  return nodes.map((current) =>
    current.id === scopeId
      ? {
          ...current,
          children: [
            ...current.children.slice(0, index),
            node,
            ...current.children.slice(index),
          ],
        }
      : { ...current, children: insertNode(current.children, scopeId, index, node) },
  )
}

export const containsNode = (node: SkillNode, id: string): boolean =>
  node.id === id || node.children.some((child) => containsNode(child, id))
