import { Check, ScanSearch, TriangleAlert } from 'lucide-react'
import type { WindowTraceFrame } from '../model'
import CorridorOperator from './CorridorOperator'

interface ManualSelection {
  anchor: number | null
  start: number | null
  end: number | null
  checked: boolean
  correct: boolean
}

interface CharacterCorridorProps {
  frame: WindowTraceFrame
  label: string
  manual?: ManualSelection
  onSelectIndex?: (index: number) => void
}

const visibleCharacter = (value: string) => value === ' ' ? '空格' : value

export default function CharacterCorridor({
  frame,
  label,
  manual,
  onSelectIndex,
}: CharacterCorridorProps) {
  const windowEnd = frame.windowEnd ?? frame.right - 1
  const frequencyEntries = Object.entries(frame.frequencies)
    .map(([code, count]) => ({ character: String.fromCharCode(Number(code)), count }))
    .sort((left, right) => left.character.localeCompare(right.character))

  return (
    <section className="corridor-scene" aria-label={label}>
      <header className="corridor-scene__header">
        <div>
          <span>CHARACTER SIGNAL</span>
          <strong>{frame.source.length} 格字符轨道</strong>
        </div>
        <div className="corridor-scene__legend" aria-label="灯廊图例">
          <span><i className="is-window" />当前窗口</span>
          <span><i className="is-best" />历史最长</span>
        </div>
      </header>

      <div className="corridor-track" role={manual ? 'group' : undefined} aria-label={manual ? '选择连续无重复窗口' : undefined}>
        <div className="corridor-rail" aria-hidden="true" />
        {frame.source.split('').map((character, index) => {
          const inWindow = !manual && index >= frame.left && index <= windowEnd
          const inBest = !manual
            && frame.bestStart !== null
            && frame.bestEnd !== null
            && index >= frame.bestStart
            && index <= frame.bestEnd
          const manualStart = manual?.start
          const manualEnd = manual?.end
          const inManual = manualStart != null
            && manualEnd != null
            && index >= manualStart
            && index <= manualEnd
          const isAnchor = manual?.anchor === index
          const isChanged = frame.changedIndex === index
          const isCurrent = !manual && frame.right === index && frame.right < frame.source.length
          const scoutState = frame.currentCode !== null ? 'reading' : 'patrolling'
          const keeperState = isChanged && frame.left === index ? 'clearing' : 'guarding'
          const className = [
            'corridor-cell',
            inWindow ? 'is-window' : '',
            inBest ? 'is-best' : '',
            inManual ? 'is-manual' : '',
            manual?.checked && inManual ? (manual?.correct ? 'is-correct' : 'is-wrong') : '',
            isAnchor ? 'is-anchor' : '',
            isChanged ? 'is-changing' : '',
            isCurrent ? 'is-current' : '',
          ].filter(Boolean).join(' ')

          return (
            <button
              key={`${character}-${index}`}
              type="button"
              className={className}
              onClick={() => onSelectIndex?.(index)}
              disabled={!manual || !onSelectIndex}
              aria-label={`${index} 号字符 ${visibleCharacter(character)}${isAnchor ? '，已选为起点' : ''}`}
            >
              <small>{String(index).padStart(2, '0')}</small>
              <strong>{character === ' ' ? '·' : character}</strong>
              {isCurrent && <CorridorOperator kind="scout" state={scoutState} />}
              {!manual && frame.left === index && (
                <CorridorOperator kind="keeper" state={keeperState} />
              )}
              {isAnchor && <span className="corridor-anchor">起点</span>}
            </button>
          )
        })}
        {!manual && frame.right >= frame.source.length && (
          <span className="corridor-track__end"><Check size={15} />巡灯员抵达末端</span>
        )}
      </div>

      <div className="corridor-console">
        <section className="corridor-readout">
          <span><small>守窗员 · 左边界</small><strong>{frame.left}</strong></span>
          <span><small>巡灯员 · 扫描头</small><strong>{Math.min(frame.right, frame.source.length)}</strong></span>
          <span className="is-emphasis"><small>最长记录</small><strong>{frame.bestLength}</strong></span>
          <span><small>当前字符</small><strong>{frame.currentCode === null ? '—' : visibleCharacter(String.fromCharCode(frame.currentCode))}</strong></span>
        </section>

        <section className="corridor-frequency" aria-label="当前窗口字符频次">
          <header><ScanSearch size={16} /><span>窗口频次台</span></header>
          <div>
            {frequencyEntries.length > 0 ? frequencyEntries.map(({ character, count }) => (
              <span key={character} className={count > 1 ? 'is-duplicate' : ''}>
                <b>{visibleCharacter(character)}</b><small>× {count}</small>
              </span>
            )) : <em>窗口尚未纳入字符</em>}
          </div>
        </section>
      </div>

      {manual?.checked && (
        <div className={`corridor-manual-verdict ${manual.correct ? 'is-correct' : 'is-wrong'}`} role="status">
          {manual.correct ? <Check size={18} /> : <TriangleAlert size={18} />}
          <span>{manual.correct ? '这是一段最长无重复连续窗口。' : '这段选择还没有同时满足“连续、无重复、最长”。'}</span>
        </div>
      )}
    </section>
  )
}
