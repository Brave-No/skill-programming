import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ChallengeSkillDefinition } from '../../challenges/types'
import { SkillProgramBuilder, type SkillProgramNode } from './SkillProgramBuilder'

type FixtureType = 'loop' | 'action'

interface FixtureNode extends SkillProgramNode<FixtureType> {
  children: FixtureNode[]
}

const skills: Array<ChallengeSkillDefinition & { type: FixtureType }> = [
  {
    type: 'loop',
    label: '遍历信号',
    shortLabel: '遍历',
    description: '建立可重复执行的作用域',
    tone: 'ink',
    createsScope: true,
    conceptIds: ['scan-loop'],
  },
  {
    type: 'action',
    label: '更新频谱',
    shortLabel: '更新',
    description: '修改当前字母计数',
    tone: 'teal',
    createsScope: false,
    conceptIds: ['read-character', 'frequency-update', 'advance-boundary'],
  },
]

const labels = {
  ariaLabel: '测试技能编排器',
  shelfKicker: '技能架',
  shelfTitle: '频谱技能',
  programKicker: '执行顺序',
  programTitle: '滑窗程序',
  rootScope: '主流程',
  nestedScope: '每一轮',
  clearProgram: '清空程序',
  emptyProgram: '选择第一项技能',
}

const renderFixture = (program: FixtureNode[], activeNodeId: string | null, disabled = false) =>
  renderToStaticMarkup(
    <SkillProgramBuilder
      program={program}
      activeNodeId={activeNodeId}
      disabled={disabled}
      skills={skills}
      labels={labels}
      createNode={(type: FixtureType): FixtureNode => ({ id: `new-${type}`, type, children: [] })}
      onChange={() => undefined}
      onClear={() => undefined}
    />,
  )

describe('SkillProgramBuilder', () => {
  it('renders a neutral empty program with every shelf skill available', () => {
    const markup = renderFixture([], null)

    expect(markup).toContain('aria-label="测试技能编排器"')
    expect(markup).toContain('选择第一项技能')
    expect(markup).toContain('取用技能：遍历信号')
    expect(markup).toContain('取用技能：更新频谱')
    expect(markup).not.toContain('is-active')
  })

  it('renders nested scopes and the active runtime node from challenge data', () => {
    const program: FixtureNode[] = [{
      id: 'loop-1',
      type: 'loop',
      children: [{ id: 'action-1', type: 'action', children: [] }],
    }]
    const markup = renderFixture(program, 'action-1', true)

    expect(markup).toContain('data-scope="root"')
    expect(markup).toContain('data-scope="loop-1"')
    expect(markup).toContain('data-program-node="action-1"')
    expect(markup).toMatch(/program-skill tone-teal is-active/)
    expect(markup).toContain('disabled=""')
  })

  it('keeps several implementation concepts inside one player-facing skill card', () => {
    const markup = renderFixture([], null)

    expect(markup).toContain('data-concept-ids="read-character frequency-update advance-boundary"')
    expect(markup.match(/取用技能：更新频谱/g)).toHaveLength(1)
  })
})
