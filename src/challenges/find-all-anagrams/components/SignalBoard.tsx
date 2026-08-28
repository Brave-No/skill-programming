import type { CSSProperties } from 'react'
import { Check, Crosshair, Radio, ScanLine } from 'lucide-react'
import type { AnagramTraceFrame } from '../model'

const LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index))

interface SignalBoardProps {
  frame: AnagramTraceFrame
  label: string
  selectedStarts?: Set<number>
  selectable?: boolean
  onSelectStart?: (index: number) => void
}

function Spectrum({
  label,
  counts,
  tone,
  activeChar,
}: {
  label: string
  counts: number[]
  tone: 'target' | 'window'
  activeChar: string | null
}) {
  const max = Math.max(1, ...counts)
  return (
    <section className={`anagram-spectrum spectrum-${tone}`} aria-label={label}>
      <header><span>{tone === 'target' ? <Radio size={14} /> : <ScanLine size={14} />}</span><strong>{label}</strong></header>
      <div className="anagram-spectrum-grid">
        {LETTERS.map((letter, index) => (
          <span key={letter} className={`${counts[index] > 0 ? 'has-count' : ''} ${activeChar === letter ? 'is-active' : ''}`}>
            <i style={{ height: `${Math.max(3, (counts[index] / max) * 28)}px` }} />
            <b>{counts[index]}</b>
            <small>{letter}</small>
          </span>
        ))}
      </div>
    </section>
  )
}

export default function SignalBoard({
  frame,
  label,
  selectedStarts = new Set(),
  selectable = false,
  onSelectStart,
}: SignalBoardProps) {
  const patternLength = frame.pattern.length
  const activeRight = frame.right ?? -1
  const activeLeft = frame.right === null ? -1 : frame.left
  const maxStart = Math.max(0, frame.source.length - patternLength)

  return (
    <section className="anagram-board" aria-label={label}>
      <header className="anagram-board-heading">
        <div><span>目标信号卡</span><strong>{frame.pattern.split('').join(' · ')}</strong></div>
        <div className="anagram-board-stats">
          <span>窗口宽度 <b>{frame.right === null ? 0 : frame.right - frame.left + 1}</b></span>
          <span className={frame.overflow ? 'is-alert' : ''}>超宽 <b>{frame.overflow ? '是' : '否'}</b></span>
          <span className={frame.frequenciesMatch ? 'is-match' : ''}>频谱一致 <b>{frame.frequenciesMatch ? '是' : '否'}</b></span>
        </div>
      </header>

      <div className="anagram-track-wrap">
        <div className="anagram-track-label"><Crosshair size={14} />源信号带 s</div>
        <div className="anagram-track" style={{ '--cell-count': frame.source.length } as CSSProperties}>
          {frame.source.split('').map((character, index) => {
            const inside = index >= activeLeft && index <= activeRight
            const eligible = index <= maxStart
            return (
              <button
                key={`${character}-${index}`}
                type="button"
                className={`${inside ? 'is-inside' : ''} ${frame.enteringIndex === index ? 'is-entering' : ''} ${frame.leavingIndex === index ? 'is-leaving' : ''} ${selectedStarts.has(index) ? 'is-selected-start' : ''}`}
                disabled={!selectable || !eligible}
                onClick={() => onSelectStart?.(index)}
                aria-label={selectable && eligible ? `选择从 ${index} 开始的窗口` : `${index} 号字母 ${character}`}
              >
                <small>{index}</small>
                <strong>{character}</strong>
                {selectedStarts.has(index) && <i><Check size={11} /></i>}
              </button>
            )
          })}
        </div>
        {frame.right !== null && (
          <div className="anagram-window-caption">
            <span>left {frame.left}</span>
            <strong>当前窗口 [{frame.left}, {frame.right}]</strong>
            <span>right {frame.right}</span>
          </div>
        )}
      </div>

      <div className="anagram-spectrums">
        <Spectrum label="目标频谱 target" counts={frame.targetCounts} tone="target" activeChar={frame.patternIndex === null ? null : frame.activeChar} />
        <Spectrum label="窗口频谱 window" counts={frame.windowCounts} tone="window" activeChar={frame.patternIndex === null ? frame.activeChar : null} />
      </div>

      <footer className="anagram-board-footer">
        <div><span>命中索引纸带</span><strong>{frame.matches.length ? frame.matches.join(' · ') : '等待命中'}</strong></div>
        <p className={`status-${frame.status}`}>{frame.message}</p>
      </footer>
    </section>
  )
}
