import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Blocks,
  Braces,
  Bug,
  Check,
  Code2,
  MousePointer2,
  RotateCcw,
  ShieldCheck,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'
import './challengeCompletion.css'

export interface ChallengeCompletionProps {
  passedCount: number
  total: number
  onClose: () => void
}

interface JourneyStage {
  label: string
  code: string
  icon: LucideIcon
  tone: 'yellow' | 'teal' | 'coral' | 'paper'
}

const JOURNEY: JourneyStage[] = [
  { label: '动手理解', code: '01', icon: MousePointer2, tone: 'yellow' },
  { label: '技能认识', code: '02', icon: Blocks, tone: 'teal' },
  { label: '规则编排', code: '03', icon: Workflow, tone: 'paper' },
  { label: '调试执行', code: '04', icon: Bug, tone: 'coral' },
  { label: '多批验证', code: '05', icon: ShieldCheck, tone: 'teal' },
  { label: '代码实战', code: '06', icon: Code2, tone: 'yellow' },
]

const CODE_SIGNALS = ['for', 'if', 'state', '[]', 'return', '++', '{}', 'API']

export function ChallengeCompletion({
  passedCount,
  total,
  onClose,
}: ChallengeCompletionProps) {
  const [cycle, setCycle] = useState(0)
  const closeButton = useRef<HTMLButtonElement | null>(null)
  const visibleChecks = Math.min(Math.max(total, 1), 12)
  const visiblePasses = total <= 0
    ? 0
    : Math.round((passedCount / total) * visibleChecks)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()

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
      className="sp-completion"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sp-completion-title"
      aria-describedby="sp-completion-description"
    >
      <button
        ref={closeButton}
        type="button"
        className="sp-completion__skip"
        onClick={onClose}
        aria-label="跳过通关动画"
        title="跳过通关动画"
      >
        <X size={20} />
      </button>

      <div key={cycle} className="sp-completion__sequence">
        <header className="sp-completion__header" aria-hidden="true">
          <span>SKILL PROGRAMMING</span>
          <strong>COMPLETION SEQUENCE // 06</strong>
        </header>

        <div className="sp-journey" aria-label="六个学习阶段已完成">
          {JOURNEY.map(({ label, code, icon: Icon, tone }, index) => (
            <div
              key={code}
              className={`sp-journey__stage tone-${tone}`}
              style={{ '--stage-delay': `${120 + index * 105}ms` } as CSSProperties}
            >
              <small>{code}</small>
              <span><Icon size={18} /></span>
              <strong>{label}</strong>
              {index < JOURNEY.length - 1 && <i aria-hidden="true" />}
            </div>
          ))}
        </div>

        <div className="sp-logic-bus" aria-hidden="true">
          <i />
          <span />
        </div>

        <section className="sp-algorithm-core" aria-label="算法回路正在闭合">
          <span className="sp-algorithm-core__shock" aria-hidden="true" />
          <span className="sp-algorithm-core__frame frame-outer" aria-hidden="true" />
          <span className="sp-algorithm-core__frame frame-middle" aria-hidden="true" />
          <div className="sp-algorithm-core__center">
            <Braces size={42} />
            <strong>ALGORITHM</strong>
            <small>VERIFIED</small>
          </div>
          <span className="sp-algorithm-core__port port-top" aria-hidden="true" />
          <span className="sp-algorithm-core__port port-right" aria-hidden="true" />
          <span className="sp-algorithm-core__port port-bottom" aria-hidden="true" />
          <span className="sp-algorithm-core__port port-left" aria-hidden="true" />

          {CODE_SIGNALS.map((signal, index) => (
            <code
              key={`${signal}-${index}`}
              className={`sp-code-signal signal-${index + 1}`}
              style={{ '--signal-delay': `${1380 + index * 70}ms` } as CSSProperties}
              aria-hidden="true"
            >
              {signal}
            </code>
          ))}
        </section>

        <div
          className="sp-verification"
          aria-label={`${passedCount} / ${total} 个公开与隐藏用例通过`}
          style={{ '--check-count': visibleChecks } as CSSProperties}
        >
          <span>程序验证</span>
          <div>
            {Array.from({ length: visibleChecks }, (_, index) => (
              <i
                key={index}
                className={index < visiblePasses ? 'is-passed' : ''}
                style={{ '--check-delay': `${1590 + index * 48}ms` } as CSSProperties}
              />
            ))}
          </div>
          <strong>{passedCount} / {total}</strong>
        </div>

        <section className="sp-completion__verdict">
          <p><Check size={16} /> 结构、语义与真实用例全部通过</p>
          <span>算法回路闭合</span>
          <div>
            <b aria-hidden="true">{'{'}</b>
            <h2 id="sp-completion-title">关卡通关</h2>
            <b aria-hidden="true">{'}'}</b>
          </div>
          <strong id="sp-completion-description">你把一个世界的规则，写成了真正可运行的程序。</strong>
        </section>

        <div className="sp-completion__actions">
          <button
            type="button"
            className="sp-completion__replay"
            onClick={() => setCycle((current) => current + 1)}
            aria-label="重播通关动画"
            title="重播通关动画"
          >
            <RotateCcw size={19} />
          </button>
          <button type="button" className="sp-completion__return" onClick={onClose}>
            <Check size={18} />
            查看通关结果
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChallengeCompletion
