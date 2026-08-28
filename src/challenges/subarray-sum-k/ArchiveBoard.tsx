import { Archive, Calculator, Crosshair, Sigma } from 'lucide-react'
import type { ArchiveTraceFrame } from './interpreter'

interface ArchiveBoardProps {
  frame: ArchiveTraceFrame
  selectable?: boolean
  selectionStart?: number | null
  selectedRangeKeys?: Set<string>
  onSelectIndex?: (index: number) => void
  label: string
}

const inCompletedRange = (index: number, keys: Set<string>) =>
  [...keys].some((key) => {
    const [start, end] = key.split(':').map(Number)
    return index >= start && index <= end
  })

export default function ArchiveBoard({
  frame,
  selectable = false,
  selectionStart = null,
  selectedRangeKeys = new Set<string>(),
  onSelectIndex,
  label,
}: ArchiveBoardProps) {
  return (
    <section className="archive-board" aria-label={label}>
      <div className="archive-meters">
        <span data-concept-id="target-k"><small>目标 K</small><strong>{frame.target}</strong></span>
        <span data-concept-id="current-prefix"><small>累计刻度</small><strong>{frame.prefix}</strong></span>
        <span data-concept-id="needed-prefix"><small>目标旧刻度</small><strong>{frame.needed ?? '—'}</strong></span>
        <span data-concept-id="answer-count"><small>命中计数</small><strong>{frame.answer}</strong></span>
      </div>

      <div className="archive-tape" data-concept-id="nums-input">
        {frame.values.map((value, index) => {
          const current = frame.currentIndex === index
          const pendingStart = selectionStart === index
          const found = inCompletedRange(index, selectedRangeKeys)
          return (
            <button
              type="button"
              key={`${index}-${value}`}
              className={`${current ? 'is-current' : ''} ${pendingStart ? 'is-start' : ''} ${found ? 'is-found' : ''}`}
              onClick={() => selectable && onSelectIndex?.(index)}
              disabled={!selectable}
              aria-pressed={selectable ? pendingStart || found : undefined}
              aria-label={`${index} 号站，数值 ${value}${current ? '，当前站' : ''}`}
            >
              <span className="archive-probe" aria-hidden="true"><Crosshair size={17} /></span>
              <strong>{value}</strong>
              <small>{index}</small>
            </button>
          )
        })}
      </div>

      <div className="archive-causal-row">
        <div className="archive-formula" data-concept-id="prefix-difference">
          <Calculator size={17} />
          <span>{frame.needed === null
            ? '等待计算目标旧刻度'
            : `${frame.prefix} - ${frame.target} = ${frame.needed}`}</span>
        </div>
        <div className="archive-match-readout" data-concept-id="frequency-lookup">
          <Sigma size={17} />
          <span>本轮调取 <strong>{frame.matchedCount}</strong> 份历史档案</span>
        </div>
      </div>

      <div className="archive-cabinet" data-concept-id="prefix-frequency">
        <header><Archive size={18} /><div><small>历史前缀</small><strong>档案柜</strong></div></header>
        <div className="archive-drawers">
          {frame.frequencyEntries.length > 0 ? frame.frequencyEntries.map((entry) => (
            <span key={entry.sum} className={frame.changedKey === entry.sum ? 'is-changing' : ''}>
              <small>刻度 {entry.sum}</small>
              <strong>{entry.count}</strong>
              <em>份</em>
            </span>
          )) : <p>等待建立起点档案</p>}
        </div>
      </div>

      <div className={`archive-frame-message status-${frame.status}`} role="status">
        <i />
        <span>{frame.message}</span>
      </div>
    </section>
  )
}
