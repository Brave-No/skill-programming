import { describe, expect, it } from 'vitest'
import { BATCHES } from '../game/model'
import { interpretSkillProgram } from './interpreter'
import { createConfiguredProgram, createSkillInvocation } from './model'

describe('interpretSkillProgram', () => {
  it('runs one configured program against all fixed batches', () => {
    const program = createConfiguredProgram()

    for (const batch of BATCHES) {
      const result = interpretSkillProgram(program, batch.input)
      expect(result.success).toBe(true)
      expect(result.finalValues).toEqual(batch.expected)
      expect(result.frames.at(-1)?.status).toBe('success')
    }
  })

  it('does not execute a program with an unresolved contract', () => {
    const result = interpretSkillProgram(
      [createSkillInvocation('advance-write', 'missing-config')],
      BATCHES[0].input,
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('执行条件')
    expect(result.frames).toHaveLength(2)
  })

  it('restores the outer scan position after each nested loop', () => {
    const outer = createSkillInvocation('for-each', 'outer-loop')
    outer.config.collection = 'warehouse-slots'
    const inner = createSkillInvocation('for-each', 'inner-loop')
    inner.config.collection = 'warehouse-slots'
    outer.children = [inner]

    const result = interpretSkillProgram([outer], BATCHES[0].input)
    const innerCompletionPositions = result.frames
      .filter(
        (frame) =>
          frame.activeBlockId === 'inner-loop' &&
          frame.message === '扫描臂已检查完所有货位。',
      )
      .map((frame) => frame.scanIndex)

    expect(innerCompletionPositions).toEqual([0, 1, 2, 3, 4])
  })

  it('reports a contract-valid but logically incomplete program', () => {
    const loop = createSkillInvocation('for-each', 'empty-loop')
    loop.config.collection = 'warehouse-slots'

    const result = interpretSkillProgram([loop], BATCHES[0].input)

    expect(result.success).toBe(false)
    expect(result.error).toContain('仍有货箱位于空位之后')
  })

  it('reports an out-of-bounds marker during real execution', () => {
    const program = createConfiguredProgram()
    const setWrite = program[0]
    if (setWrite.skillType !== 'set-write') throw new Error('unexpected fixture')
    setWrite.config.targetIndex = 4

    const result = interpretSkillProgram(program, BATCHES[0].input)

    expect(result.success).toBe(false)
    expect(result.error).toContain('越过仓库边界')
  })
})
