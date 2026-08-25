import {
  CAPABILITY_LABELS,
  type CapabilityId,
  type PositionReference,
  type SkillInvocation,
} from './model'

export interface ContractIssue {
  instanceId: string | null
  field: string
  code: 'empty-program' | 'missing-config' | 'missing-capability' | 'same-reference'
  message: string
}

export interface ContractValidation {
  valid: boolean
  issues: ContractIssue[]
  capabilitiesBefore: Record<string, CapabilityId[]>
  scopeCapabilities: Record<string, CapabilityId[]>
}

const positionCapability = (reference: PositionReference): CapabilityId => reference

const sortedCapabilities = (capabilities: Set<CapabilityId>) => [...capabilities]

export const validateSkillProgram = (
  program: SkillInvocation[],
): ContractValidation => {
  const issues: ContractIssue[] = []
  const capabilitiesBefore: Record<string, CapabilityId[]> = {}
  const scopeCapabilities: Record<string, CapabilityId[]> = {}

  if (program.length === 0) {
    issues.push({
      instanceId: null,
      field: 'program',
      code: 'empty-program',
      message: '规则区是空的。',
    })
  }

  const missingConfig = (node: SkillInvocation, field: string, label: string) => {
    issues.push({
      instanceId: node.instanceId,
      field,
      code: 'missing-config',
      message: `${label}尚未选择。`,
    })
  }

  const requireCapability = (
    node: SkillInvocation,
    field: string,
    capability: CapabilityId,
    available: Set<CapabilityId>,
  ) => {
    if (available.has(capability)) return true
    issues.push({
      instanceId: node.instanceId,
      field,
      code: 'missing-capability',
      message: `当前作用域没有“${CAPABILITY_LABELS[capability]}”。`,
    })
    return false
  }

  const validateScope = (
    nodes: SkillInvocation[],
    inherited: Set<CapabilityId>,
    scopeId: string,
  ) => {
    const available = new Set(inherited)
    scopeCapabilities[scopeId] = sortedCapabilities(available)

    for (const node of nodes) {
      capabilitiesBefore[node.instanceId] = sortedCapabilities(available)

      switch (node.skillType) {
        case 'set-write': {
          if (node.config.targetIndex === null) {
            missingConfig(node, 'targetIndex', '装载标记的位置')
          } else if (node.config.targetIndex < 0 || node.config.targetIndex > 4) {
            missingConfig(node, 'targetIndex', '有效货位')
          } else {
            available.add('write-pointer')
          }
          break
        }

        case 'for-each': {
          let collectionReady = false
          if (node.config.collection === null) {
            missingConfig(node, 'collection', '遍历对象')
          } else {
            collectionReady = requireCapability(
              node,
              'collection',
              'warehouse-slots',
              available,
            )
          }

          const childCapabilities = new Set(available)
          if (collectionReady) {
            childCapabilities.add('current-slot')
            childCapabilities.add('scan-index')
          }
          validateScope(node.children, childCapabilities, node.instanceId)
          break
        }

        case 'if-occupied': {
          if (node.config.subject === null) {
            missingConfig(node, 'subject', '判断对象')
          } else {
            requireCapability(node, 'subject', 'current-slot', available)
          }
          validateScope(node.children, new Set(available), node.instanceId)
          break
        }

        case 'swap': {
          const references: Array<['left' | 'right', PositionReference | null]> = [
            ['left', node.config.left],
            ['right', node.config.right],
          ]
          for (const [field, reference] of references) {
            if (reference === null) {
              missingConfig(node, field, field === 'left' ? '第一个位置' : '第二个位置')
            } else {
              requireCapability(node, field, positionCapability(reference), available)
            }
          }
          if (node.config.left !== null && node.config.left === node.config.right) {
            issues.push({
              instanceId: node.instanceId,
              field: 'references',
              code: 'same-reference',
              message: '交换需要两个不同的位置。',
            })
          }
          break
        }

        case 'advance-write': {
          if (node.config.pointer === null) {
            missingConfig(node, 'pointer', '移动对象')
          } else {
            requireCapability(node, 'pointer', 'write-pointer', available)
          }
          break
        }
      }
    }
  }

  validateScope(program, new Set<CapabilityId>(['warehouse-slots']), 'root')

  return {
    valid: issues.length === 0,
    issues,
    capabilitiesBefore,
    scopeCapabilities,
  }
}
