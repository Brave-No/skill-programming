import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChallengeCompletion } from './ChallengeCompletion'

const renderFixture = (passedCount: number, total: number) => renderToStaticMarkup(
  <ChallengeCompletion passedCount={passedCount} total={total} onClose={() => undefined} />,
)

describe('ChallengeCompletion', () => {
  it.each([
    { challenge: 'trapping rain water', passedCount: 10, total: 10 },
    { challenge: 'move zeroes V2', passedCount: 8, total: 8 },
  ])('renders the generic completed journey for $challenge', ({ passedCount, total }) => {
    const markup = renderFixture(passedCount, total)

    expect(markup).toContain(`aria-label="${passedCount} / ${total} 个公开与隐藏用例通过"`)
    expect(markup).toContain(`<strong>${passedCount} / ${total}</strong>`)
    expect(markup).toContain('关卡通关')
    expect(markup).toContain('算法回路闭合')
    expect(markup).toContain('动手理解')
    expect(markup).toContain('技能认识')
    expect(markup).toContain('规则编排')
    expect(markup).toContain('调试执行')
    expect(markup).toContain('多批验证')
    expect(markup).toContain('代码实战')
  })
})
