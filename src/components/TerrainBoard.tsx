import type { CSSProperties } from 'react'
import { CloudRain, Droplets } from 'lucide-react'
import type { ScoutSide } from '../game/model'

interface TerrainBoardProps {
  terrain: number[]
  water: number[]
  left: number | null
  right: number | null
  leftMax: number
  rightMax: number
  leftMaxIndex: number | null
  rightMaxIndex: number | null
  selectedSide: ScoutSide | null
  changedIndex: number | null
  selectable?: boolean
  selectedIndices?: Set<number>
  onToggleIndex?: (index: number) => void
  raining?: boolean
  label: string
}

function ScoutGlyph({ side }: { side: ScoutSide }) {
  return (
    <svg
      viewBox="0 0 64 42"
      className={`scout-glyph scout-glyph--${side}`}
      role="img"
      aria-label={side === 'left' ? '左侧巡线员' : '右侧巡线员'}
    >
      <path d="M10 31h44l-4 7H14z" className="scout-glyph__base" />
      <circle cx="20" cy="36" r="4" className="scout-glyph__wheel" />
      <circle cx="44" cy="36" r="4" className="scout-glyph__wheel" />
      <path d="M20 29V14h24v15" className="scout-glyph__body" />
      <path d="M32 14V6m0 0 7 5m-7-5-7 5" className="scout-glyph__antenna" />
      <circle cx="26" cy="21" r="2.5" className="scout-glyph__eye" />
      <circle cx="38" cy="21" r="2.5" className="scout-glyph__eye" />
    </svg>
  )
}

export default function TerrainBoard({
  terrain,
  water,
  left,
  right,
  leftMax,
  rightMax,
  leftMaxIndex,
  rightMaxIndex,
  selectedSide,
  changedIndex,
  selectable = false,
  selectedIndices = new Set<number>(),
  onToggleIndex,
  raining = false,
  label,
}: TerrainBoardProps) {
  const maxLevel = Math.max(6, ...terrain.map((height, index) => height + water[index]))
  const boardStyle = {
    '--column-count': terrain.length,
    '--level-count': maxLevel,
  } as CSSProperties

  return (
    <section className={`terrain-scene ${raining ? 'is-raining' : ''}`} aria-label={label} data-concept-id="height-input">
      <div className="scene-sky" aria-hidden="true">
        <span className="rain-line rain-line--1" />
        <span className="rain-line rain-line--2" />
        <span className="rain-line rain-line--3" />
        <span className="rain-line rain-line--4" />
        <span className="rain-line rain-line--5" />
        <span className="rain-line rain-line--6" />
        <span className="rain-line rain-line--7" />
        <span className="rain-line rain-line--8" />
        <span className="rain-line rain-line--9" />
        <span className="rain-line rain-line--10" />
      </div>

      <div className="scene-readout">
        <span><CloudRain size={16} /> 地形断面</span>
        {(left !== null || right !== null) && (
          <div className="shore-readout" aria-label="左右两侧记住的最高柱">
            <span className={selectedSide === 'left' ? 'is-active is-left' : 'is-left'} data-concept-id="left-maximum">
              <small>左岸最高柱</small>
              <strong>{leftMax}</strong>
              <em>{leftMaxIndex === null ? '未记录' : `${leftMaxIndex} 号`}</em>
            </span>
            <span className={selectedSide === 'right' ? 'is-active is-right' : 'is-right'} data-concept-id="right-maximum">
              <small>右岸最高柱</small>
              <strong>{rightMax}</strong>
              <em>{rightMaxIndex === null ? '未记录' : `${rightMaxIndex} 号`}</em>
            </span>
          </div>
        )}
        <span data-concept-id="water-total"><Droplets size={16} /> 已记录 {water.reduce((sum, value) => sum + value, 0)} 格</span>
      </div>

      <div className="terrain-grid" style={boardStyle}>
        {terrain.map((height, index) => {
          const hasLeftScout = left === index
          const hasRightScout = right === index
          const isSelected = selectedIndices.has(index)
          const isLeftMaximum = leftMaxIndex === index
          const isRightMaximum = rightMaxIndex === index
          const classes = [
            'terrain-column',
            selectable ? 'is-selectable' : '',
            isSelected ? 'is-marked' : '',
            changedIndex === index ? 'is-changing' : '',
            isLeftMaximum ? 'is-left-maximum' : '',
            isRightMaximum ? 'is-right-maximum' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              type="button"
              className={classes}
              key={`${index}-${height}`}
              onClick={() => selectable && onToggleIndex?.(index)}
              disabled={!selectable}
              aria-pressed={selectable ? isSelected : undefined}
              aria-label={
                selectable
                  ? `${isSelected ? '取消标记' : '标记'} ${index} 号位置，高度 ${height}`
                  : `${index} 号位置，高度 ${height}，积水 ${water[index]}`
              }
            >
              <span className="scout-track" aria-hidden="true">
                {hasLeftScout && (
                  <span className={`scout-position scout-position--left ${selectedSide === 'left' ? 'is-active' : ''}`} data-concept-id="left-position">
                    <ScoutGlyph side="left" />
                  </span>
                )}
                {hasRightScout && (
                  <span className={`scout-position scout-position--right ${selectedSide === 'right' ? 'is-active' : ''}`} data-concept-id="right-position">
                    <ScoutGlyph side="right" />
                  </span>
                )}
              </span>

              <span className="terrain-cells" aria-hidden="true">
                {Array.from({ length: maxLevel }, (_, reverseLevel) => {
                  const level = maxLevel - reverseLevel
                  const isTerrain = level <= height
                  const isWater = level > height && level <= height + water[index]
                  return (
                    <span
                      key={level}
                      className={`terrain-cell ${isTerrain ? 'is-ground' : ''} ${isWater ? 'is-water' : ''}`}
                    />
                  )
                })}
              </span>

              <span className="column-index">{index}</span>
              {(isLeftMaximum || isRightMaximum) && (
                <span className="maximum-source-markers" aria-hidden="true">
                  {isLeftMaximum && <i className="is-left" data-concept-id="left-maximum">左最高</i>}
                  {isRightMaximum && <i className="is-right" data-concept-id="right-maximum">右最高</i>}
                </span>
              )}
              {isSelected && <span className="prediction-flag" aria-hidden="true"><Droplets size={15} /></span>}
            </button>
          )
        })}
      </div>

    </section>
  )
}
