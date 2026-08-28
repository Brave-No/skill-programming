import { Check, CornerDownLeft, Gauge, ScanLine, Target } from 'lucide-react'
import type { MinimumWindowNeedEntry } from '../model'

interface MinimumWindowBoardProps {
  source: string
  target: string
  left: number | null
  right: number | null
  missing: number
  bestStart: number | null
  bestLength: number | null
  incomingCode?: number | null
  outgoingCode?: number | null
  needEntries?: MinimumWindowNeedEntry[]
  selectedStart?: number | null
  selectedEnd?: number | null
  interactive?: boolean
  onSelectIndex?: (index: number) => void
}

const targetCharacters = (target: string) => {
  const counts = new Map<string, number>()
  for (const character of target) counts.set(character, (counts.get(character) ?? 0) + 1)
  return [...counts.entries()]
}

export default function MinimumWindowBoard({
  source,
  target,
  left,
  right,
  missing,
  bestStart,
  bestLength,
  incomingCode = null,
  outgoingCode = null,
  needEntries = [],
  selectedStart = null,
  selectedEnd = null,
  interactive = false,
  onSelectIndex,
}: MinimumWindowBoardProps) {
  const needByCharacter = new Map(needEntries.map((entry) => [entry.character, entry.balance]))
  const bestEnd = bestStart === null || bestLength === null ? null : bestStart + bestLength - 1
  const selectionLow = selectedStart === null
    ? null
    : Math.min(selectedStart, selectedEnd ?? selectedStart)
  const selectionHigh = selectedStart === null
    ? null
    : Math.max(selectedStart, selectedEnd ?? selectedStart)
  const visibleRight = right === null ? null : Math.min(right, source.length - 1)

  return (
    <section className="mw-board" aria-label="最小覆盖子串窗口校准台">
      <header className="mw-board__status">
        <div>
          <span><Target size={15} /> 目标需求</span>
          <strong>{target || '空'}</strong>
        </div>
        <div>
          <span><Gauge size={15} /> 总欠账</span>
          <strong className={missing === 0 ? 'is-covered' : ''}>{missing}</strong>
        </div>
        <div>
          <span><Check size={15} /> 历史最短</span>
          <strong>{bestStart === null || bestLength === null ? '待记录' : source.slice(bestStart, bestStart + bestLength)}</strong>
        </div>
      </header>

      <div className="mw-target-ledger" aria-label="目标字符欠账">
        {targetCharacters(target).map(([character, required]) => {
          const balance = needByCharacter.get(character)
          return (
            <div key={character} className={balance !== undefined && balance <= 0 ? 'is-satisfied' : ''}>
              <strong>{character}</strong>
              <span>需求 {required}</span>
              <b>{balance === undefined ? `欠 ${required}` : balance > 0 ? `欠 ${balance}` : balance === 0 ? '刚好' : `余 ${Math.abs(balance)}`}</b>
            </div>
          )
        })}
      </div>

      <div className="mw-track-wrap">
        <div className="mw-track-label"><ScanLine size={15} /> 源文字带 · {source.length} 格</div>
        <div className="mw-character-track" role={interactive ? 'group' : undefined} aria-label={interactive ? '选择连续窗口' : undefined}>
          {Array.from(source).map((character, index) => {
            const inCurrent = left !== null && visibleRight !== null && index >= left && index <= visibleRight
            const inBest = bestStart !== null && bestEnd !== null && index >= bestStart && index <= bestEnd
            const selected = selectionLow !== null && selectionHigh !== null && index >= selectionLow && index <= selectionHigh
            const incoming = incomingCode !== null && index === right && source.charCodeAt(index) === incomingCode
            const outgoing = outgoingCode !== null && index === left && source.charCodeAt(index) === outgoingCode
            return (
              <button
                key={`${character}-${index}`}
                type="button"
                className={`mw-character-cell ${inCurrent ? 'is-window' : ''} ${inBest ? 'is-best' : ''} ${selected ? 'is-selected' : ''} ${incoming ? 'is-incoming' : ''} ${outgoing ? 'is-outgoing' : ''}`}
                disabled={!interactive}
                onClick={() => onSelectIndex?.(index)}
                aria-label={`${index} 号字符 ${character}${selected ? '，已选择' : ''}`}
              >
                <small>{index}</small>
                <strong>{character}</strong>
                {index === left && <i className="is-left">L</i>}
                {index === right && <i className="is-right">R</i>}
              </button>
            )
          })}
          {right !== null && right >= source.length && (
            <div className="mw-track-end"><CornerDownLeft size={16} /><span>R</span><small>末尾</small></div>
          )}
        </div>
      </div>

      <footer className="mw-board__legend">
        <span><i className="legend-current" /> 当前窗口</span>
        <span><i className="legend-best" /> 历史最短</span>
        {interactive && <strong>依次点击起点和终点</strong>}
      </footer>
    </section>
  )
}
