import { describe, expect, it } from 'vitest'
import { createCorrectRainWaterProgram } from '../challenges/trapping-rain-water/qaFixtures'
import { calculateWater, interpretProgram } from './interpreter'
import { createSkillNode } from './model'

describe('calculateWater', () => {
  it('calculates water per position', () => {
    expect(calculateWater([4, 2, 0, 6, 2, 5])).toEqual([0, 2, 4, 0, 3, 0])
  })

  it('handles terrain that cannot hold water', () => {
    expect(calculateWater([0, 1, 2, 3])).toEqual([0, 0, 0, 0])
  })
})

describe('interpretProgram', () => {
  it.each([
    [[4, 2, 0, 6, 2, 5], 9],
    [[3, 0, 1, 3, 0, 5], 8],
    [[5, 2, 1, 2, 1, 5], 14],
  ])('runs one program against terrain %j', (terrain, expectedTotal) => {
    const result = interpretProgram(createCorrectRainWaterProgram('test'), terrain as number[])
    expect(result.success).toBe(true)
    expect(result.totalWater).toBe(expectedTotal)
  })

  it('reads both endpoint heights before choosing the first side', () => {
    const result = interpretProgram(createCorrectRainWaterProgram('test'), [4, 2, 0, 3, 2, 5])
    const deployed = result.frames.find((frame) => frame.activeNodeId === 'test-deploy')
    const firstAdvance = result.frames.find((frame) => frame.message.includes('向内来到'))

    expect(deployed).toMatchObject({
      left: 0,
      right: 5,
      leftMax: 4,
      rightMax: 5,
      leftMaxIndex: 0,
      rightMaxIndex: 5,
    })
    expect(firstAdvance).toMatchObject({ left: 1, right: 5 })
    expect(firstAdvance?.message).toContain('左侧巡线员')
  })

  it('keeps the left scout on a new summit and moves the lower right side next', () => {
    const result = interpretProgram(createCorrectRainWaterProgram('test'), [4, 2, 0, 6, 2, 5])
    const summitFrameIndex = result.frames.findIndex(
      (frame) => frame.changedIndex === 3 && frame.leftMax === 6,
    )
    const nextAdvance = result.frames
      .slice(summitFrameIndex + 1)
      .find((frame) => frame.message.includes('向内来到'))

    expect(summitFrameIndex).toBeGreaterThan(0)
    expect(result.frames.some((frame) => frame.message.includes('左侧巡线员向内来到 4')))
      .toBe(false)
    expect(nextAdvance).toMatchObject({ left: 3, right: 4 })
    expect(nextAdvance?.message).toContain('右侧巡线员')
  })

  it('把新峰值和其来源位置更新在独立帧中', () => {
    const result = interpretProgram(createCorrectRainWaterProgram('maximum'), [4, 2, 0, 6, 2, 5])
    const maximumFrame = result.frames.find(
      (frame) => frame.activeNodeId === 'maximum-update-max' && frame.leftMax === 6,
    )

    expect(maximumFrame).toMatchObject({
      changedIndex: 3,
      leftMax: 6,
      leftMaxIndex: 3,
    })
    expect(maximumFrame?.message).toContain('3 号柱高 6')
    expect(maximumFrame?.message).toContain('左岸最高柱更新到 3 号')
  })

  it('计算新位置前必须先向内移动', () => {
    const patrol = createSkillNode('patrol', 'stalled-patrol')
    patrol.children = [
      createSkillNode('compare', 'stalled-compare'),
      createSkillNode('collect', 'stalled-collect'),
    ]
    const result = interpretProgram(
      [createSkillNode('deploy', 'stalled-deploy'), patrol],
      [3, 0, 2],
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('还没有向内移动')
  })

  it('向内移动后必须先更新最高柱再计算积水', () => {
    const patrol = createSkillNode('patrol', 'missing-update-patrol')
    patrol.children = [
      createSkillNode('compare', 'missing-update-compare'),
      createSkillNode('advance', 'missing-update-advance'),
      createSkillNode('collect', 'missing-update-collect'),
    ]
    const result = interpretProgram(
      [createSkillNode('deploy', 'missing-update-deploy'), patrol],
      [3, 0, 2],
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('当前柱还没有和本侧最高柱比较并更新')
  })

  it('拒绝在巡线员移动前更新最高柱', () => {
    const patrol = createSkillNode('patrol', 'early-update-patrol')
    patrol.children = [
      createSkillNode('compare', 'early-update-compare'),
      createSkillNode('update-max', 'early-update-maximum'),
      createSkillNode('advance', 'early-update-advance'),
      createSkillNode('collect', 'early-update-collect'),
    ]
    const result = interpretProgram(
      [createSkillNode('deploy', 'early-update-deploy'), patrol],
      [3, 0, 2],
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('还没有进入新位置')
  })

  it('显示最高柱、当前柱高和累加结果的完整减法', () => {
    const result = interpretProgram(createCorrectRainWaterProgram('formula'), [4, 2, 0, 6, 2, 5])
    const collectionFrame = result.frames.find(
      (frame) => frame.activeNodeId === 'formula-collect' && frame.changedIndex === 1,
    )

    expect(collectionFrame?.message).toBe('左岸最高柱 4 - 1 号柱高 2 = 当前积水 2 格；累计 2 格。')
  })

  it('reports a patrol that cannot move', () => {
    const patrol = createSkillNode('patrol', 'stalled-patrol')
    patrol.children = [createSkillNode('compare', 'stalled-compare')]
    const result = interpretProgram(
      [createSkillNode('deploy', 'stalled-deploy'), patrol],
      [3, 0, 2],
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('停在了原地')
  })

  it('rejects collecting before choosing a side', () => {
    const result = interpretProgram(
      [createSkillNode('deploy'), createSkillNode('collect')],
      [3, 0, 2],
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('还没有选出')
  })
})
