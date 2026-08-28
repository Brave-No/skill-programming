import { useMemo, useState } from 'react'
import {
  Braces,
  Check,
  ChevronLeft,
  CircleDot,
  GitBranch,
  GripVertical,
  Lightbulb,
  Play,
  Repeat2,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import './ruleHintPreview.css'

type SkillType = 'loop' | 'condition' | 'action'
type MobileView = 'scene' | 'program'

interface SkillDefinition {
  id: SkillType
  label: string
  kind: string
  description: string
  icon: typeof Repeat2
}

const SKILLS: SkillDefinition[] = [
  {
    id: 'loop',
    label: '遍历数据',
    kind: '控制技能',
    description: '重复处理每个数据项',
    icon: Repeat2,
  },
  {
    id: 'condition',
    label: '判断条件',
    kind: '控制技能',
    description: '决定何时执行动作',
    icon: GitBranch,
  },
  {
    id: 'action',
    label: '执行动作',
    kind: '动作技能',
    description: '改变当前数据状态',
    icon: Zap,
  },
]

const HINTS = [
  {
    title: '先建立遍历范围',
    reason: '当前规则还没有重复处理数据的范围。',
    skill: 'loop' as const,
    target: 'root',
  },
  {
    title: '在遍历里加入判断',
    reason: '每轮处理还没有决定什么时候执行动作。',
    skill: 'condition' as const,
    target: 'loop',
  },
  {
    title: '补上条件成立后的动作',
    reason: '判断已经建立，但成立时还没有执行内容。',
    skill: 'action' as const,
    target: 'condition',
  },
  {
    title: '运行当前批次',
    reason: '规则骨架已经完整，可以观察真实执行结果。',
    skill: null,
    target: 'run',
  },
] as const

function DropTarget({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={`rule-hint-drop ${active ? 'is-recommended' : ''}`} data-hint-target={label}>
      <span>{active ? '建议放这里' : label}</span>
    </div>
  )
}

function ProgramNode({
  skill,
  children,
  highlighted,
}: {
  skill: SkillDefinition
  children?: React.ReactNode
  highlighted?: boolean
}) {
  const Icon = skill.icon
  return (
    <div className={`rule-hint-node tone-${skill.id} ${highlighted ? 'is-new' : ''}`}>
      <div className="rule-hint-node__head">
        <GripVertical size={16} aria-hidden="true" />
        <span><Icon size={17} aria-hidden="true" /></span>
        <div><strong>{skill.label}</strong><small>{skill.kind}</small></div>
        <Check size={16} aria-label="已加入" />
      </div>
      {children && <div className="rule-hint-node__scope">{children}</div>}
    </div>
  )
}

export function RuleHintPreview() {
  const [programDepth, setProgramDepth] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('program')
  const hint = HINTS[Math.min(programDepth, HINTS.length - 1)]
  const nextSkill = SKILLS[programDepth]
  const programSkills = SKILLS.slice(0, programDepth)
  const progressLabel = `${programDepth} / ${SKILLS.length}`

  const tree = useMemo(() => {
    if (!programSkills.length) {
      return <DropTarget active={showHint && hint.target === 'root'} label="将控制技能放到这里" />
    }

    const action = programSkills[2]
    const condition = programSkills[1]
    const loop = programSkills[0]
    return (
      <ProgramNode skill={loop} highlighted={programDepth === 1}>
        {condition ? (
          <ProgramNode skill={condition} highlighted={programDepth === 2}>
            {action ? (
              <ProgramNode skill={action} highlighted={programDepth === 3} />
            ) : (
              <DropTarget active={showHint && hint.target === 'condition'} label="条件成立时" />
            )}
          </ProgramNode>
        ) : (
          <DropTarget active={showHint && hint.target === 'loop'} label="每轮执行" />
        )}
      </ProgramNode>
    )
  }, [hint.target, programDepth, programSkills, showHint])

  const addSkill = (skill: SkillType) => {
    if (nextSkill?.id !== skill) return
    setProgramDepth((depth) => Math.min(depth + 1, SKILLS.length))
    setHasRun(false)
  }

  const reset = () => {
    setProgramDepth(0)
    setHasRun(false)
  }

  return (
    <div className="rule-hint-preview">
      <header className="rule-hint-topbar">
        <a href="/" aria-label="返回挑战目录"><ChevronLeft size={19} /><span>挑战目录</span></a>
        <div className="rule-hint-brand"><span><Braces size={20} /></span><strong>技能编程</strong></div>
        <div className="rule-hint-stage"><b>03</b><span>规则编排</span></div>
      </header>

      <nav className="rule-hint-journey" aria-label="学习阶段">
        <span className="is-complete"><i><Check size={12} /></i>动手理解</span>
        <span className="is-complete"><i><Check size={12} /></i>技能认识</span>
        <span className="is-current"><i>3</i>规则编排</span>
        <span><i>4</i>调试执行</span>
        <span><i>5</i>多批验证</span>
        <span><i>6</i>代码实战</span>
      </nav>

      <div className="rule-hint-mobile-switch" role="group" aria-label="工作区视图">
        <button type="button" className={mobileView === 'scene' ? 'is-active' : ''} onClick={() => setMobileView('scene')}>数据场景</button>
        <button type="button" className={mobileView === 'program' ? 'is-active' : ''} onClick={() => setMobileView('program')}>规则编排</button>
      </div>

      <main className="rule-hint-workspace">
        <section className={`rule-hint-scene ${mobileView === 'scene' ? 'is-mobile-active' : ''}`} aria-labelledby="rule-hint-scene-title">
          <header className="rule-hint-pane-heading">
            <div><p>当前批次</p><h1 id="rule-hint-scene-title">数据场景</h1></div>
            <span className={hasRun ? 'is-pass' : ''}><CircleDot size={14} />{hasRun ? '运行通过' : '等待运行'}</span>
          </header>

          <div className="rule-hint-array" aria-label="当前数据 4、1、7、2、6">
            {[4, 1, 7, 2, 6].map((value, index) => (
              <div key={index} className={hasRun && index < 3 ? 'is-visited' : ''}>
                <small>{index}</small>
                <strong>{value}</strong>
                {index === (hasRun ? 2 : 0) && <span>当前</span>}
              </div>
            ))}
          </div>

          <div className="rule-hint-trace">
            <div><span>规则节点</span><strong>{programDepth}</strong></div>
            <div><span>当前状态</span><strong>{hasRun ? '已验证' : programDepth === 3 ? '可运行' : '待编排'}</strong></div>
            <div><span>执行步数</span><strong>{hasRun ? '3' : '-'}</strong></div>
          </div>

          <div className={`rule-hint-console ${hasRun ? 'is-visible' : ''}`} aria-live="polite">
            <span><Sparkles size={16} /></span>
            <div><strong>{hasRun ? '当前批次通过' : '执行轨迹'}</strong><p>{hasRun ? '规则按顺序处理了当前数据。' : '运行后在这里观察每一步状态。'}</p></div>
          </div>
        </section>

        <section className={`rule-hint-program ${mobileView === 'program' ? 'is-mobile-active' : ''}`} aria-labelledby="rule-hint-program-title">
          <header className="rule-hint-pane-heading">
            <div><p>组合可重复执行的动作</p><h1 id="rule-hint-program-title">规则编排</h1></div>
            <span>{progressLabel} 个节点</span>
          </header>

          <div className="rule-hint-actions">
            <button
              type="button"
              className={`rule-hint-help ${showHint ? 'is-active' : ''}`}
              onClick={() => setShowHint((visible) => !visible)}
              aria-expanded={showHint}
              aria-controls="rule-hint-advice"
            >
              <Lightbulb size={17} />下一步提示
            </button>
            <button type="button" className="rule-hint-reset" onClick={reset} disabled={programDepth === 0 && !hasRun}>
              <RotateCcw size={16} />清空程序
            </button>
          </div>

          {showHint && (
            <aside id="rule-hint-advice" className="rule-hint-advice" aria-live="polite">
              <span><Lightbulb size={19} /></span>
              <div><small>下一步建议</small><strong>{hasRun ? '当前批次已验证' : hint.title}</strong><p>{hasRun ? '这组数据已经通过，可以继续验证下一批。' : hint.reason}</p></div>
              <button type="button" onClick={() => setShowHint(false)} aria-label="关闭下一步提示" title="关闭"><X size={17} /></button>
            </aside>
          )}

          <div className="rule-hint-builder">
            <section className="rule-hint-shelf" aria-labelledby="rule-hint-shelf-title">
              <div className="rule-hint-section-label"><span id="rule-hint-shelf-title">技能架</span><small>点击加入</small></div>
              <div className="rule-hint-skill-list">
                {SKILLS.map((skill, index) => {
                  const Icon = skill.icon
                  const isAdded = index < programDepth
                  const isNext = nextSkill?.id === skill.id
                  const isRecommended = showHint && hint.skill === skill.id && !hasRun
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      className={`rule-hint-skill tone-${skill.id} ${isAdded ? 'is-added' : ''} ${isRecommended ? 'is-recommended' : ''}`}
                      onClick={() => addSkill(skill.id)}
                      disabled={!isNext}
                      aria-label={`${skill.label}${isAdded ? '，已加入' : isNext ? '，加入规则' : '，需要前置规则'}`}
                    >
                      <span><Icon size={18} /></span>
                      <div><strong>{skill.label}</strong><small>{skill.description}</small></div>
                      {isAdded ? <Check size={16} /> : <b>+</b>}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rule-hint-tree" aria-labelledby="rule-hint-tree-title">
              <div className="rule-hint-section-label"><span id="rule-hint-tree-title">程序树</span><small>{programDepth ? '从上到下执行' : '尚未添加规则'}</small></div>
              <div className="rule-hint-tree__body">{tree}</div>
            </section>
          </div>

          <footer className="rule-hint-runbar">
            <p><span className={programDepth === 3 ? 'is-ready' : ''} />{programDepth === 3 ? '规则结构完整' : `还需 ${3 - programDepth} 个节点`}</p>
            <button
              type="button"
              className={showHint && hint.target === 'run' && !hasRun ? 'is-recommended' : ''}
              disabled={programDepth < 3}
              onClick={() => setHasRun(true)}
            >
              {hasRun ? <Check size={17} /> : <Play size={17} fill="currentColor" />}
              {hasRun ? '当前批次已通过' : '运行当前批次'}
            </button>
          </footer>
        </section>
      </main>
    </div>
  )
}
