import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Anchor,
  BetweenHorizontalStart,
  Bot,
  Droplets,
  Mountain,
  Play,
  Repeat2,
  ScanLine,
  X,
} from 'lucide-react'
import { getSkillDefinition, type SkillType } from '../game/model'

interface SkillIntroModalProps {
  skillType: SkillType
  onClose: () => void
}

interface IntroCopy {
  lead: string
  outcome: string
}

const TERRAIN = [4, 2, 0, 6, 2, 5]

const INTRO_COPY: Record<SkillType, IntroCopy> = {
  deploy: {
    lead: '两名巡线员从峡谷两端同时就位。',
    outcome: '读取起始岸线：左侧 4，右侧 5。',
  },
  patrol: {
    lead: '重复执行内部技能，让两侧巡线员逐步靠近。',
    outcome: '两名巡线员相遇后，巡检循环结束。',
  },
  compare: {
    lead: '比较两侧已经见过的最高岸线。',
    outcome: '左岸 4 低于右岸 5，本轮处理左侧。',
  },
  collect: {
    lead: '最高柱更新完成后，用本侧最高柱减去当前柱高。',
    outcome: '左岸最高柱 4 − 当前柱高 2 = 本轮积水 2 格。',
  },
  advance: {
    lead: '选出当前低岸后，巡线员先向峡谷内部移动。',
    outcome: '左侧巡线员从 0 号位置前进到 1 号位置。',
  },
  'update-max': {
    lead: '把当前柱高与本侧已经记住的最高柱比较。',
    outcome: '3 号柱高 6 超过旧记录 4，左岸最高柱更新为 3 号柱。',
  },
}

function SkillIcon({ type }: { type: SkillType }) {
  switch (type) {
    case 'deploy':
      return <Anchor size={20} />
    case 'patrol':
      return <Repeat2 size={20} />
    case 'compare':
      return <ScanLine size={20} />
    case 'collect':
      return <Droplets size={20} />
    case 'advance':
      return <BetweenHorizontalStart size={20} />
    case 'update-max':
      return <Mountain size={20} />
  }
}

function IntroScout({ side }: { side: 'left' | 'right' }) {
  return (
    <span className={`skill-intro-scout skill-intro-scout--${side}`} aria-hidden="true">
      <Bot size={27} strokeWidth={2.2} />
      <small>{side === 'left' ? '左' : '右'}</small>
    </span>
  )
}

export default function SkillIntroModal({ skillType, onClose }: SkillIntroModalProps) {
  const [runId, setRunId] = useState(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const definition = getSkillDefinition(skillType)
  const intro = INTRO_COPY[skillType]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="skill-intro-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="skill-intro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-intro-title"
      >
        <header className="skill-intro-header">
          <span className={`skill-intro-icon tone-${definition.tone}`} aria-hidden="true">
            <SkillIcon type={skillType} />
          </span>
          <div>
            <span className="section-kicker">技能短片</span>
            <h2 id="skill-intro-title">{definition.label}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="skill-intro-close"
            onClick={onClose}
            aria-label="关闭技能短片"
            title="关闭"
          >
            <X size={20} />
          </button>
        </header>

        <div
          key={`${skillType}-${runId}`}
          className={`skill-intro-stage skill-intro-stage--${skillType}`}
          data-skill-intro={skillType}
          data-concept-ids={definition.conceptIds.join(' ')}
        >
          <div className="skill-intro-sky" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </div>
          <div className="skill-intro-shores" aria-hidden="true">
            <span>{skillType === 'update-max' ? '左岸最高柱 4 → 6' : '左岸最高柱 4'}</span>
            <span>右岸最高柱 5</span>
          </div>

          <div className="skill-intro-terrain" aria-hidden="true">
            {TERRAIN.map((height, index) => {
              const waterDepth = skillType === 'collect' && index === 1 ? 2 : 0
              const isNewMaximum = skillType === 'update-max' && index === 3
              const columnStyle = {
                '--skill-intro-height': `${height * 17}px`,
                '--skill-intro-water': `${waterDepth * 17}px`,
              } as CSSProperties

              return (
                <span
                  className={`skill-intro-column ${isNewMaximum ? 'is-new-maximum' : ''}`}
                  style={columnStyle}
                  key={index}
                >
                  <i className="skill-intro-water" />
                  <i className="skill-intro-ground" />
                  {isNewMaximum && <b className="skill-intro-maximum-badge">新最高柱</b>}
                  <small>{index}</small>
                </span>
              )
            })}
          </div>

          <IntroScout side="left" />
          <IntroScout side="right" />

          {skillType === 'patrol' && (
            <span className="skill-intro-loop" aria-hidden="true">
              <Repeat2 size={16} /> 直到相遇
            </span>
          )}
          {skillType === 'compare' && (
            <span className="skill-intro-decision" aria-hidden="true">
              <ScanLine size={16} /> 处理左岸
            </span>
          )}
          {skillType === 'collect' && (
            <div
              className="skill-intro-equation"
              role="img"
              aria-label="左岸最高柱 4，减去当前柱高 2，等于积水深度 2 格"
            >
              <span className="skill-intro-equation__term skill-intro-equation__term--shore">
                <small>左岸最高柱</small>
                <strong>4</strong>
              </span>
              <b className="skill-intro-equation__operator">−</b>
              <span className="skill-intro-equation__term skill-intro-equation__term--ground">
                <small>当前柱高</small>
                <strong>2</strong>
              </span>
              <b className="skill-intro-equation__operator skill-intro-equation__operator--equals">=</b>
              <span className="skill-intro-equation__term skill-intro-equation__term--water">
                <small>积水深度</small>
                <strong>2 格</strong>
              </span>
            </div>
          )}

          <span className="skill-intro-progress" aria-hidden="true"><i /></span>
        </div>

        <footer className="skill-intro-footer">
          <div aria-live="polite">
            <p>{intro.lead}</p>
            <strong>{intro.outcome}</strong>
          </div>
          <button
            type="button"
            className="skill-intro-replay"
            onClick={() => setRunId((current) => current + 1)}
            aria-label="重新播放技能短片"
            title="重新播放"
          >
            <Play size={19} fill="currentColor" />
          </button>
        </footer>
      </section>
    </div>
  )
}
