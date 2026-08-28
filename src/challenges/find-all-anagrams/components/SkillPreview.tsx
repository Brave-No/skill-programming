import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { getAnagramSkill, type AnagramSkillType } from '../model'

const PREVIEW_FACTS: Record<AnagramSkillType, { before: string; trigger: string; after: string }> = {
  prepare: { before: '频谱与纸带保留旧读数', trigger: '启动一次全新扫描', after: '状态归零，目标字母逐个写入目标频谱' },
  'scan-source': { before: '右探针尚未进入信号带', trigger: 'right < s.length()', after: '每轮右移并执行窗口规则' },
  'add-incoming': { before: '新字母 b 在窗口外', trigger: '右探针读取 b', after: '窗口 b 格加一' },
  'if-overflow': { before: '窗口刚纳入一个字母', trigger: 'right - left + 1 > p.length()', after: '移出左字符并让 left 前进一格' },
  'if-match': { before: '窗口已恢复固定宽度', trigger: '比较两份 26 格频谱', after: '完全相等时记录当前 left' },
}

export default function SkillPreview({ type, onClose }: { type: AnagramSkillType; onClose: () => void }) {
  const [cycle, setCycle] = useState(0)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const definition = getAnagramSkill(type)
  const fact = PREVIEW_FACTS[type]

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="anagram-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="anagram-preview-title">
      <section className={`anagram-preview tone-${definition.tone}`}>
        <header>
          <div><span>技能预演</span><h2 id="anagram-preview-title">{definition.label}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭技能预演" title="关闭"><X size={19} /></button>
        </header>
        <div key={cycle} className="anagram-preview-stage" aria-label={`${fact.before}，${fact.trigger}，${fact.after}`}>
          <div className="preview-signal-row">
            {['a', 'b', 'c', 'd', 'e'].map((letter, index) => <span key={letter} className={index === 2 ? 'is-active' : ''}>{letter}<i>{index}</i></span>)}
          </div>
          <div className="preview-frequency-row">
            {['a', 'b', 'c', 'd', 'e'].map((letter, index) => <span key={letter} className={index === 2 ? 'is-active' : ''}><b>{index === 2 ? '0 → 1' : '0'}</b><small>{letter}</small></span>)}
          </div>
        </div>
        <dl className="anagram-preview-chain">
          <div><dt>旧状态</dt><dd>{fact.before}</dd></div>
          <div><dt>触发条件</dt><dd>{fact.trigger}</dd></div>
          <div><dt>新状态</dt><dd>{fact.after}</dd></div>
        </dl>
        <p>{definition.description}</p>
        <footer>
          <button type="button" className="is-icon" onClick={() => setCycle((current) => current + 1)} aria-label="重播技能预演" title="重播"><RotateCcw size={18} /></button>
          <button type="button" className="is-primary" onClick={onClose}><Check size={17} />结束预演</button>
        </footer>
      </section>
    </div>
  )
}
