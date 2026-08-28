import { getMinimumWindowSkill, type MinimumWindowSkillNode, type MinimumWindowSkillType } from './model'

export interface MinimumWindowContractIssue {
  nodeId: string | null
  message: string
}

export interface MinimumWindowContractResult {
  valid: boolean
  issues: MinimumWindowContractIssue[]
}

type Scope = 'root' | 'source' | 'shrink'

const allowedByScope: Record<Scope, MinimumWindowSkillType[]> = {
  root: ['initialize-window', 'scan-source'],
  source: ['read-incoming-character', 'shrink-covered-window'],
  shrink: ['save-best-window', 'read-outgoing-character'],
}

const childScope: Partial<Record<MinimumWindowSkillType, Scope>> = {
  'scan-source': 'source',
  'shrink-covered-window': 'shrink',
}

const requiredOrder: Record<Scope, MinimumWindowSkillType[]> = {
  root: ['initialize-window', 'scan-source'],
  source: ['read-incoming-character', 'shrink-covered-window'],
  shrink: ['save-best-window', 'read-outgoing-character'],
}

const validateScope = (
  nodes: MinimumWindowSkillNode[],
  scope: Scope,
  issues: MinimumWindowContractIssue[],
) => {
  const allowed = allowedByScope[scope]
  nodes.forEach((node) => {
    const definition = getMinimumWindowSkill(node.type)
    if (!allowed.includes(node.type)) {
      issues.push({ nodeId: node.id, message: `“${definition.label}”不能放在当前作用域。` })
      return
    }
    const nestedScope = childScope[node.type]
    if (nestedScope) {
      if (node.children.length === 0) {
        issues.push({ nodeId: node.id, message: `“${definition.label}”的作用域还是空的。` })
      } else {
        validateScope(node.children, nestedScope, issues)
      }
    } else if (node.children.length > 0) {
      issues.push({ nodeId: node.id, message: `“${definition.label}”不是控制技能，不能包含子技能。` })
    }
  })

  const actual = nodes.map((node) => node.type)
  const expected = requiredOrder[scope]
  if (actual.length !== expected.length || actual.some((type, index) => type !== expected[index])) {
    issues.push({
      nodeId: nodes.find((node, index) => node.type !== expected[index])?.id ?? null,
      message: `当前作用域需要依次执行：${expected.map((type) => getMinimumWindowSkill(type).shortLabel).join(' -> ')}。`,
    })
  }
}

export const validateMinimumWindowProgram = (
  program: MinimumWindowSkillNode[],
): MinimumWindowContractResult => {
  const issues: MinimumWindowContractIssue[] = []
  validateScope(program, 'root', issues)
  return { valid: issues.length === 0, issues }
}
