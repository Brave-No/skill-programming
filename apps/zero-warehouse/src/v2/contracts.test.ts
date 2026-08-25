import { describe, expect, it } from 'vitest'
import { validateSkillProgram } from './contracts'
import {
  createConfiguredProgram,
  createSkillInvocation,
  type SkillInvocation,
} from './model'

describe('validateSkillProgram', () => {
  it('accepts the configured double-pointer program', () => {
    const validation = validateSkillProgram(createConfiguredProgram())

    expect(validation.valid).toBe(true)
    expect(validation.issues).toEqual([])
    expect(validation.scopeCapabilities['v2-loop']).toEqual(
      expect.arrayContaining(['warehouse-slots', 'write-pointer', 'current-slot']),
    )
  })

  it('requires every new invocation to be configured', () => {
    const validation = validateSkillProgram([
      createSkillInvocation('set-write', 'unconfigured-set'),
      createSkillInvocation('for-each', 'unconfigured-loop'),
    ])

    expect(validation.valid).toBe(false)
    expect(validation.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['targetIndex', 'collection']),
    )
  })

  it('keeps an invalid root-level condition but reports its missing scope capability', () => {
    const condition = createSkillInvocation('if-occupied', 'root-condition')
    condition.config.subject = 'current-slot'

    const validation = validateSkillProgram([condition])

    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        instanceId: 'root-condition',
        code: 'missing-capability',
        field: 'subject',
      }),
    )
  })

  it('reports using the write pointer before it is initialized', () => {
    const advance = createSkillInvocation('advance-write', 'early-advance')
    advance.config.pointer = 'write-pointer'
    const setWrite = createSkillInvocation('set-write', 'late-set')
    setWrite.config.targetIndex = 0

    const validation = validateSkillProgram([advance, setWrite])

    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        instanceId: 'early-advance',
        code: 'missing-capability',
      }),
    )
  })

  it('does not leak a capability created inside a conditional body', () => {
    const loop = createSkillInvocation('for-each', 'outer-loop')
    loop.config.collection = 'warehouse-slots'
    const condition = createSkillInvocation('if-occupied', 'condition')
    condition.config.subject = 'current-slot'
    const conditionalSet = createSkillInvocation('set-write', 'conditional-set')
    conditionalSet.config.targetIndex = 0
    condition.children = [conditionalSet]
    const swap = createSkillInvocation('swap', 'after-condition-swap')
    swap.config.left = 'current-slot'
    swap.config.right = 'write-pointer'
    loop.children = [condition, swap]

    const validation = validateSkillProgram([loop])

    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        instanceId: 'after-condition-swap',
        field: 'right',
        code: 'missing-capability',
      }),
    )
  })

  it('allows a for skill to contain another for skill', () => {
    const outer = createSkillInvocation('for-each', 'outer')
    outer.config.collection = 'warehouse-slots'
    const inner = createSkillInvocation('for-each', 'inner')
    inner.config.collection = 'warehouse-slots'
    outer.children = [inner]

    expect(validateSkillProgram([outer]).valid).toBe(true)
  })

  it('requires swap references to be different', () => {
    const setWrite = createSkillInvocation('set-write', 'set')
    setWrite.config.targetIndex = 0
    const loop = createSkillInvocation('for-each', 'loop')
    loop.config.collection = 'warehouse-slots'
    const swap = createSkillInvocation('swap', 'same-swap')
    swap.config.left = 'current-slot'
    swap.config.right = 'current-slot'
    loop.children = [swap]

    const validation = validateSkillProgram([setWrite, loop])

    expect(validation.issues).toContainEqual(
      expect.objectContaining({ instanceId: 'same-swap', code: 'same-reference' }),
    )
  })

  it('creates independent instances of the same reusable skill', () => {
    const first = createSkillInvocation('for-each')
    const second = createSkillInvocation('for-each')
    const program: SkillInvocation[] = [first, second]

    expect(first.instanceId).not.toBe(second.instanceId)
    expect(program).toHaveLength(2)
  })
})
