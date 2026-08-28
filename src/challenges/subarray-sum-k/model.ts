export type ArchiveSkillType =
  | 'initialize-archive'
  | 'scan-values'
  | 'accumulate-prefix'
  | 'count-matches'
  | 'record-prefix'

export type ArchiveCapability =
  | 'values'
  | 'target'
  | 'archive'
  | 'prefix'
  | 'answer'
  | 'current-value'
  | 'updated-prefix'
  | 'needed-prefix'
  | 'counted-matches'
  | 'recorded-prefix'

export interface ArchiveSkillNode {
  id: string
  type: ArchiveSkillType
  children: ArchiveSkillNode[]
}

export interface ArchiveSkillDefinition {
  type: ArchiveSkillType
  label: string
  shortLabel: string
  worldAction: string
  logicPurpose: string
  description: string
  tone: 'yellow' | 'teal' | 'coral' | 'ink' | 'steel'
  conceptIds: string[]
  requires: ArchiveCapability[]
  provides: ArchiveCapability[]
  createsScope: boolean
}

export const ARCHIVE_SKILLS: ArchiveSkillDefinition[] = [
  {
    type: 'initialize-archive',
    label: '建立起点档案',
    shortLabel: '建立档案',
    worldAction: '把巡查起点的累计刻度 0 登记一次。',
    logicPurpose: '让从 0 号站开始的目标区间也能被计数。',
    description: '先保存空前缀，再把累计刻度、探针和命中计数归零。',
    tone: 'yellow',
    conceptIds: ['prefix-frequency', 'current-prefix', 'answer-count'],
    requires: ['values', 'target'],
    provides: ['archive', 'prefix', 'answer'],
    createsScope: false,
  },
  {
    type: 'scan-values',
    label: '逐项巡查',
    shortLabel: '逐项巡查',
    worldAction: '沿数值带依次进入每一个站点。',
    logicPurpose: '让同一套前缀规则处理全部数组元素。',
    description: '从 0 号站开始，在探针到达数值带末端前重复处理当前值。',
    tone: 'ink',
    conceptIds: ['nums-input', 'scan-index', 'iteration-boundary'],
    requires: ['archive', 'prefix', 'answer'],
    provides: ['current-value'],
    createsScope: true,
  },
  {
    type: 'accumulate-prefix',
    label: '更新累计刻度',
    shortLabel: '更新累计值',
    worldAction: '把当前站数值加到累计刻度。',
    logicPurpose: '得到从数组起点到当前位置的前缀和。',
    description: '把 nums[index] 加入 prefixSum，并把新值留给本轮后续动作。',
    tone: 'teal',
    conceptIds: ['nums-input', 'scan-index', 'current-prefix'],
    requires: ['prefix', 'current-value'],
    provides: ['updated-prefix'],
    createsScope: false,
  },
  {
    type: 'count-matches',
    label: '统计目标区间',
    shortLabel: '统计命中',
    worldAction: '算出目标旧刻度，并调取它的全部历史档案章。',
    logicPurpose: '当前累计值减去 K，历史出现次数就是本轮新增答案。',
    description: '内部依次计算 prefixSum - k、查询历史次数并累加答案。',
    tone: 'coral',
    conceptIds: ['target-k', 'current-prefix', 'needed-prefix', 'prefix-difference', 'prefix-frequency', 'frequency-lookup', 'answer-count'],
    requires: ['archive', 'updated-prefix', 'target', 'answer'],
    provides: ['counted-matches'],
    createsScope: false,
  },
  {
    type: 'record-prefix',
    label: '登记当前刻度',
    shortLabel: '登记刻度',
    worldAction: '给当前累计刻度的档案再加一枚章。',
    logicPurpose: '让后续位置可以把当前前缀作为历史起点。',
    description: '查询完成后，把当前 prefixSum 的出现次数增加一。',
    tone: 'teal',
    conceptIds: ['current-prefix', 'prefix-frequency', 'frequency-record'],
    requires: ['archive', 'updated-prefix', 'counted-matches'],
    provides: ['recorded-prefix'],
    createsScope: false,
  },
]

let skillSequence = 0

export const createArchiveSkillNode = (
  type: ArchiveSkillType,
  id?: string,
): ArchiveSkillNode => {
  skillSequence += 1
  return {
    id: id ?? `archive-skill-${Date.now().toString(36)}-${skillSequence.toString(36)}`,
    type,
    children: [],
  }
}

export const getArchiveSkill = (type: ArchiveSkillType) =>
  ARCHIVE_SKILLS.find((skill) => skill.type === type)!

export const findArchiveSkillNode = (
  nodes: ArchiveSkillNode[],
  id: string,
): ArchiveSkillNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = findArchiveSkillNode(node.children, id)
    if (child) return child
  }
  return null
}

export const removeArchiveSkillNode = (
  nodes: ArchiveSkillNode[],
  id: string,
): { nodes: ArchiveSkillNode[]; removed: ArchiveSkillNode | null } => {
  let removed: ArchiveSkillNode | null = null
  const next: ArchiveSkillNode[] = []
  for (const node of nodes) {
    if (node.id === id) {
      removed = node
      continue
    }
    const childResult = removeArchiveSkillNode(node.children, id)
    if (childResult.removed) removed = childResult.removed
    next.push({ ...node, children: childResult.nodes })
  }
  return { nodes: next, removed }
}

export const insertArchiveSkillNode = (
  nodes: ArchiveSkillNode[],
  scopeId: string,
  node: ArchiveSkillNode,
  index: number,
): ArchiveSkillNode[] => {
  if (scopeId === 'root') {
    const next = [...nodes]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node)
    return next
  }
  return nodes.map((candidate) => candidate.id === scopeId
    ? {
        ...candidate,
        children: [
          ...candidate.children.slice(0, index),
          node,
          ...candidate.children.slice(index),
        ],
      }
    : {
        ...candidate,
        children: insertArchiveSkillNode(candidate.children, scopeId, node, index),
      })
}

export const cloneArchiveProgram = (nodes: ArchiveSkillNode[]): ArchiveSkillNode[] =>
  nodes.map((node) => ({ ...node, children: cloneArchiveProgram(node.children) }))
