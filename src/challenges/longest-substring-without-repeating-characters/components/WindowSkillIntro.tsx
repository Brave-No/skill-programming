import { Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getWindowSkill, type WindowSkillType } from '../model'
import CorridorOperator from './CorridorOperator'

interface WindowSkillIntroProps {
  skillType: WindowSkillType
  onClose: () => void
  onPreviewed?: (type: WindowSkillType) => void
}

const PREVIEW_COPY: Record<WindowSkillType, { cause: string; action: string; result: string }> = {
  initialize: {
    cause: '一条新字符带进入灯廊',
    action: '守窗员与巡灯员同时回到 0 号站，频次台清空',
    result: '窗口和最长记录从空状态开始',
  },
  scan: {
    cause: '巡灯员仍位于字符串范围内',
    action: '用探照灯读取当前字符，执行窗口技能，再前进一格',
    result: '每个字符都会被完整处理一次',
  },
  'shrink-duplicates': {
    cause: '当前字符的窗口频次大于 0',
    action: '守窗员持续清退左端字符并向右收紧边界',
    result: '直到当前字符不再重复',
  },
  'admit-current': {
    cause: '当前字符已不重复',
    action: '它的窗口频次加一',
    result: '当前字符正式进入窗口',
  },
  'update-best': {
    cause: '窗口维持无重复状态',
    action: '比较 best 与 right - left + 1',
    result: '历史最长记录只增不减',
  },
}

const PREVIEW_WINDOW: Record<WindowSkillType, { left: number; right: number; active: number[]; duplicate?: number; moving?: 'left' | 'right' }> = {
  initialize: { left: 0, right: 0, active: [] },
  scan: { left: 0, right: 3, active: [0, 1, 2], moving: 'right' },
  'shrink-duplicates': { left: 0, right: 2, active: [0, 1], duplicate: 2, moving: 'left' },
  'admit-current': { left: 1, right: 2, active: [1, 2] },
  'update-best': { left: 1, right: 3, active: [1, 2, 3] },
}

export default function WindowSkillIntro({ skillType, onClose, onPreviewed }: WindowSkillIntroProps) {
  const [runId, setRunId] = useState(0)
  const closeButton = useRef<HTMLButtonElement | null>(null)
  const definition = getWindowSkill(skillType)
  const copy = PREVIEW_COPY[skillType]
  const preview = PREVIEW_WINDOW[skillType]
  const source = 'abacd'

  useEffect(() => {
    closeButton.current?.focus()
    onPreviewed?.(skillType)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onPreviewed, skillType])

  return (
    <div className="corridor-intro-backdrop" role="dialog" aria-modal="true" aria-labelledby="corridor-intro-title">
      <section className={`corridor-intro tone-${definition.tone}`}>
        <header>
          <div><span>技能预演 · 核心逻辑</span><h2 id="corridor-intro-title">{definition.label}</h2></div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="关闭技能预演" title="关闭"><X size={19} /></button>
        </header>

        <div key={runId} className={`corridor-intro__stage preview-${skillType}`}>
          <div className="corridor-intro__track" aria-label={`${definition.label}预演`}>
            {source.split('').map((character, index) => (
              <span
                key={`${character}-${index}`}
                className={`${preview.active.includes(index) ? 'is-active' : ''} ${preview.duplicate === index ? 'is-duplicate' : ''}`}
              >
                <small>{index}</small><strong>{character}</strong>
                {preview.left === index && (
                  <CorridorOperator
                    compact
                    kind="keeper"
                    state={preview.duplicate !== undefined ? 'clearing' : preview.moving === 'left' ? 'moving' : 'guarding'}
                  />
                )}
                {preview.right === index && (
                  <CorridorOperator
                    compact
                    kind="scout"
                    state={preview.moving === 'right' ? 'moving' : 'reading'}
                  />
                )}
              </span>
            ))}
          </div>
          <div className="corridor-intro__signal" aria-hidden="true">
            <i /><i /><i />
          </div>
        </div>

        <div className="corridor-intro__chain">
          <span><small>触发</small><strong>{copy.cause}</strong></span>
          <i aria-hidden="true" />
          <span><small>动作</small><strong>{copy.action}</strong></span>
          <i aria-hidden="true" />
          <span><small>结果</small><strong>{copy.result}</strong></span>
        </div>

        <footer>
          <p>{definition.description}</p>
          <button type="button" onClick={() => setRunId((current) => current + 1)} aria-label="重新播放技能预演" title="重新播放"><Play size={18} fill="currentColor" /></button>
        </footer>
      </section>
    </div>
  )
}
