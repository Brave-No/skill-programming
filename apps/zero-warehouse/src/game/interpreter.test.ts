import { describe, expect, it } from 'vitest'
import {
  BATCHES,
  createBlock,
  createCorrectProgram,
  type BlockNode,
} from './model'
import { interpretProgram } from './interpreter'

describe('interpretProgram', () => {
  it('runs the correct program against all fixed batches', () => {
    const program = createCorrectProgram()

    for (const batch of BATCHES) {
      const result = interpretProgram(program, batch.input)
      expect(result.success).toBe(true)
      expect(result.finalValues).toEqual(batch.expected)
      expect(result.frames.at(-1)?.status).toBe('success')
    }
  })

  it('rejects an empty program', () => {
    const result = interpretProgram([], BATCHES[0].input)

    expect(result.success).toBe(false)
    expect(result.error).toContain('规则区是空的')
  })

  it('reports a swap placed outside a scan', () => {
    const program = [createBlock('set-write'), createBlock('swap')]
    const result = interpretProgram(program, BATCHES[0].input)

    expect(result.success).toBe(false)
    expect(result.error).toContain('扫描尚未开始')
  })

  it('reports an advance placed before initialization', () => {
    const result = interpretProgram([createBlock('advance-write')], BATCHES[0].input)

    expect(result.success).toBe(false)
    expect(result.error).toContain('装载标记还没有')
  })

  it('fails when advancing on every scanned position pushes the marker out of bounds', () => {
    const loop = createBlock('for-each')
    loop.children = [createBlock('advance-write'), createBlock('swap')]
    const program = [createBlock('set-write'), loop]
    const result = interpretProgram(program, BATCHES[0].input)

    expect(result.success).toBe(false)
    expect(result.error).toContain('越过仓库边界')
  })

  it('describes a completed but incorrect arrangement without revealing a fix', () => {
    const loop = createBlock('for-each')
    const condition = createBlock('if-occupied')
    condition.children = [createBlock('advance-write')]
    loop.children = [condition]
    const program: BlockNode[] = [createBlock('set-write'), loop]
    const result = interpretProgram(program, BATCHES[0].input)

    expect(result.success).toBe(false)
    expect(result.error).toContain('仍有货箱位于空位之后')
  })

  it('handles an all-cargo input without failing at the terminal marker', () => {
    const result = interpretProgram(createCorrectProgram(), [7, 4, 2])

    expect(result.success).toBe(true)
    expect(result.finalValues).toEqual([7, 4, 2])
  })
})
