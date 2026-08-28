import {
  getArchiveSkill,
  type ArchiveCapability,
  type ArchiveSkillNode,
} from './model'

export interface ArchiveContractIssue {
  nodeId: string | null
  message: string
}

export interface ArchiveContractResult {
  valid: boolean
  issues: ArchiveContractIssue[]
}

const capabilityLabel: Record<ArchiveCapability, string> = {
  values: '数组数值带',
  target: '目标 K',
  archive: '前缀档案',
  prefix: '累计刻度',
  answer: '命中计数',
  'current-value': '当前站数值',
  'updated-prefix': '本轮已更新的累计刻度',
  'needed-prefix': '目标旧刻度',
  'counted-matches': '本轮已累加的历史命中',
  'recorded-prefix': '本轮已登记的当前刻度',
}

const validateScope = (
  nodes: ArchiveSkillNode[],
  incoming: Set<ArchiveCapability>,
  scope: 'root' | 'scan',
  issues: ArchiveContractIssue[],
) => {
  const capabilities = new Set(incoming)
  for (const node of nodes) {
    const definition = getArchiveSkill(node.type)
    if (scope === 'root' && !['initialize-archive', 'scan-values'].includes(node.type)) {
      issues.push({ nodeId: node.id, message: `“${definition.label}”需要放进逐项巡查的作用域。` })
      continue
    }
    if (scope === 'scan' && ['initialize-archive', 'scan-values'].includes(node.type)) {
      issues.push({ nodeId: node.id, message: `“${definition.label}”不能放在另一轮巡查里面。` })
      continue
    }
    const missing = definition.requires.filter((capability) => !capabilities.has(capability))
    if (missing.length > 0) {
      issues.push({
        nodeId: node.id,
        message: `“${definition.label}”还缺少${missing.map((item) => capabilityLabel[item]).join('、')}。`,
      })
      continue
    }
    definition.provides.forEach((capability) => capabilities.add(capability))
    if (node.type === 'scan-values') {
      if (node.children.length === 0) {
        issues.push({ nodeId: node.id, message: '逐项巡查里面还没有放入处理当前站的技能。' })
      } else {
        validateScope(
          node.children,
          new Set([...capabilities, 'current-value']),
          'scan',
          issues,
        )
      }
    } else if (node.children.length > 0) {
      issues.push({ nodeId: node.id, message: `“${definition.label}”不是控制技能，不能拥有子技能。` })
    }
  }
}

export const validateArchiveProgram = (program: ArchiveSkillNode[]): ArchiveContractResult => {
  const issues: ArchiveContractIssue[] = []
  validateScope(program, new Set(['values', 'target']), 'root', issues)
  const initializationCount = program.filter((node) => node.type === 'initialize-archive').length
  const scanCount = program.filter((node) => node.type === 'scan-values').length
  if (initializationCount !== 1) {
    issues.unshift({ nodeId: null, message: '根作用域需要且只需要一次“建立起点档案”。' })
  }
  if (scanCount !== 1) {
    issues.unshift({ nodeId: null, message: '根作用域需要且只需要一次“逐项巡查”。' })
  }
  if (
    initializationCount === 1
    && scanCount === 1
    && program.findIndex((node) => node.type === 'initialize-archive')
      > program.findIndex((node) => node.type === 'scan-values')
  ) {
    issues.unshift({ nodeId: null, message: '必须先建立起点档案，再开始逐项巡查。' })
  }
  return { valid: issues.length === 0, issues }
}
