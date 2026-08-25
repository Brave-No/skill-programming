export type SkillType =
  | 'set-write'
  | 'for-each'
  | 'if-occupied'
  | 'swap'
  | 'advance-write'

export type CapabilityId =
  | 'warehouse-slots'
  | 'current-slot'
  | 'scan-index'
  | 'write-pointer'

export type PositionReference = 'current-slot' | 'write-pointer'

interface InvocationBase<TType extends SkillType, TConfig> {
  instanceId: string
  skillType: TType
  config: TConfig
  children: SkillInvocation[]
}

export type SkillInvocation =
  | InvocationBase<'set-write', { targetIndex: number | null }>
  | InvocationBase<'for-each', { collection: 'warehouse-slots' | null }>
  | InvocationBase<'if-occupied', { subject: 'current-slot' | null }>
  | InvocationBase<
      'swap',
      { left: PositionReference | null; right: PositionReference | null }
    >
  | InvocationBase<'advance-write', { pointer: 'write-pointer' | null }>

export interface SkillContract {
  requires: CapabilityId[]
  provides: CapabilityId[]
  createsScope: boolean
}

export interface SkillDefinition {
  skillType: SkillType
  label: string
  shortLabel: string
  tone: 'yellow' | 'teal' | 'coral' | 'ink' | 'steel'
  contract: SkillContract
}

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  'warehouse-slots': '仓库货位',
  'current-slot': '当前货位',
  'scan-index': '扫描序号',
  'write-pointer': '装载标记',
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    skillType: 'set-write',
    label: '定位装载标记',
    shortLabel: '定位标记',
    tone: 'yellow',
    contract: { requires: [], provides: ['write-pointer'], createsScope: false },
  },
  {
    skillType: 'for-each',
    label: '逐个遍历',
    shortLabel: '遍历',
    tone: 'ink',
    contract: {
      requires: ['warehouse-slots'],
      provides: ['current-slot', 'scan-index'],
      createsScope: true,
    },
  },
  {
    skillType: 'if-occupied',
    label: '条件判断',
    shortLabel: '如果有货',
    tone: 'teal',
    contract: { requires: ['current-slot'], provides: [], createsScope: true },
  },
  {
    skillType: 'swap',
    label: '交换位置',
    shortLabel: '交换',
    tone: 'coral',
    contract: {
      requires: ['current-slot', 'write-pointer'],
      provides: [],
      createsScope: false,
    },
  },
  {
    skillType: 'advance-write',
    label: '移动装载标记',
    shortLabel: '标记前进',
    tone: 'steel',
    contract: { requires: ['write-pointer'], provides: [], createsScope: false },
  },
]

let instanceSequence = 0

const nextInstanceId = () => {
  instanceSequence += 1
  return `skill-${Date.now().toString(36)}-${instanceSequence.toString(36)}`
}

export function createSkillInvocation(
  skillType: 'set-write',
  instanceId?: string,
): Extract<SkillInvocation, { skillType: 'set-write' }>
export function createSkillInvocation(
  skillType: 'for-each',
  instanceId?: string,
): Extract<SkillInvocation, { skillType: 'for-each' }>
export function createSkillInvocation(
  skillType: 'if-occupied',
  instanceId?: string,
): Extract<SkillInvocation, { skillType: 'if-occupied' }>
export function createSkillInvocation(
  skillType: 'swap',
  instanceId?: string,
): Extract<SkillInvocation, { skillType: 'swap' }>
export function createSkillInvocation(
  skillType: 'advance-write',
  instanceId?: string,
): Extract<SkillInvocation, { skillType: 'advance-write' }>
export function createSkillInvocation(
  skillType: SkillType,
  instanceId?: string,
): SkillInvocation
export function createSkillInvocation(
  skillType: SkillType,
  instanceId: string = nextInstanceId(),
): SkillInvocation {
  switch (skillType) {
    case 'set-write':
      return { instanceId, skillType, config: { targetIndex: null }, children: [] }
    case 'for-each':
      return { instanceId, skillType, config: { collection: null }, children: [] }
    case 'if-occupied':
      return { instanceId, skillType, config: { subject: null }, children: [] }
    case 'swap':
      return {
        instanceId,
        skillType,
        config: { left: null, right: null },
        children: [],
      }
    case 'advance-write':
      return { instanceId, skillType, config: { pointer: null }, children: [] }
  }
}

export const getSkillDefinition = (skillType: SkillType) =>
  SKILL_DEFINITIONS.find((definition) => definition.skillType === skillType)!

export const collectInvocationIds = (nodes: SkillInvocation[]): string[] =>
  nodes.flatMap((node) => [node.instanceId, ...collectInvocationIds(node.children)])

export const cloneSkillProgram = (nodes: SkillInvocation[]): SkillInvocation[] =>
  nodes.map(
    (node) =>
      ({
        ...node,
        config: { ...node.config },
        children: cloneSkillProgram(node.children),
      }) as SkillInvocation,
  )

export const findInvocation = (
  nodes: SkillInvocation[],
  instanceId: string,
): SkillInvocation | null => {
  for (const node of nodes) {
    if (node.instanceId === instanceId) return node
    const child = findInvocation(node.children, instanceId)
    if (child) return child
  }
  return null
}

export interface InvocationParent {
  scopeId: string
  index: number
}

export const findInvocationParent = (
  nodes: SkillInvocation[],
  instanceId: string,
  scopeId = 'root',
): InvocationParent | null => {
  const directIndex = nodes.findIndex((node) => node.instanceId === instanceId)
  if (directIndex >= 0) return { scopeId, index: directIndex }

  for (const node of nodes) {
    const parent = findInvocationParent(node.children, instanceId, node.instanceId)
    if (parent) return parent
  }
  return null
}

export const removeInvocation = (
  nodes: SkillInvocation[],
  instanceId: string,
): { nodes: SkillInvocation[]; removed: SkillInvocation | null } => {
  let removed: SkillInvocation | null = null
  const next: SkillInvocation[] = []

  for (const node of nodes) {
    if (node.instanceId === instanceId) {
      removed = node
      continue
    }
    const childResult = removeInvocation(node.children, instanceId)
    if (childResult.removed) removed = childResult.removed
    next.push({ ...node, children: childResult.nodes } as SkillInvocation)
  }

  return { nodes: next, removed }
}

export const insertInvocation = (
  nodes: SkillInvocation[],
  scopeId: string,
  invocation: SkillInvocation,
  index: number,
): SkillInvocation[] => {
  if (scopeId === 'root') {
    const next = [...nodes]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, invocation)
    return next
  }

  return nodes.map((node) => {
    if (node.instanceId === scopeId) {
      const nextChildren = [...node.children]
      nextChildren.splice(
        Math.max(0, Math.min(index, nextChildren.length)),
        0,
        invocation,
      )
      return { ...node, children: nextChildren } as SkillInvocation
    }
    return {
      ...node,
      children: insertInvocation(node.children, scopeId, invocation, index),
    } as SkillInvocation
  })
}

export const replaceInvocation = (
  nodes: SkillInvocation[],
  replacement: SkillInvocation,
): SkillInvocation[] =>
  nodes.map((node) =>
    node.instanceId === replacement.instanceId
      ? replacement
      : ({
          ...node,
          children: replaceInvocation(node.children, replacement),
        } as SkillInvocation),
  )

export const createConfiguredProgram = (): SkillInvocation[] => {
  const setWrite = createSkillInvocation('set-write', 'v2-set-write')
  setWrite.config.targetIndex = 0

  const loop = createSkillInvocation('for-each', 'v2-loop')
  loop.config.collection = 'warehouse-slots'

  const condition = createSkillInvocation('if-occupied', 'v2-condition')
  condition.config.subject = 'current-slot'

  const swap = createSkillInvocation('swap', 'v2-swap')
  swap.config.left = 'current-slot'
  swap.config.right = 'write-pointer'

  const advance = createSkillInvocation('advance-write', 'v2-advance')
  advance.config.pointer = 'write-pointer'

  condition.children = [swap, advance]
  loop.children = [condition]
  return [setWrite, loop]
}
