import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Bot, RotateCcw, Undo2 } from 'lucide-react'
import { RobotGlyph } from './RobotGlyph'

type SlotValue = number | null

interface ManualStageProps {
  onComplete: () => void
}

interface ManualSlotProps {
  index: number
  value: SlotValue
  selected: boolean
  onSelect: (index: number) => void
}

function ManualSlot({ index, value, selected, onSelect }: ManualSlotProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `manual-slot-${index}`,
    data: { index },
    disabled: value !== null,
  })
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `manual-crate-${index}`,
    data: { index },
    disabled: value === null,
  })

  return (
    <button
      ref={value === null ? setDropRef : setDragRef}
      type="button"
      className={`manual-slot ${value === null ? 'is-empty' : 'has-crate'} ${
        selected ? 'is-selected' : ''
      } ${isOver ? 'is-over' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={() => onSelect(index)}
      aria-label={value === null ? `${index} 号空货位` : `${index} 号货位，货箱 ${value}`}
      {...(value === null ? {} : attributes)}
      {...(value === null ? {} : listeners)}
    >
      <span className="slot-index">{index}</span>
      {value === null ? (
        <span className="empty-mark">0</span>
      ) : (
        <span className="crate crate-manual">
          <span>{value}</span>
        </span>
      )}
    </button>
  )
}

export function ManualStage({ onComplete }: ManualStageProps) {
  const initialSlots = useMemo<SlotValue[]>(() => [null, 4, null, 2], [])
  const [slots, setSlots] = useState<SlotValue[]>(initialSlots)
  const [history, setHistory] = useState<SlotValue[][]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [activeValue, setActiveValue] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const cargo = slots.filter((value): value is number => value !== null)
  const isCompact = slots.slice(0, cargo.length).every((value) => value !== null)
  const isComplete = slots[0] === 4 && slots[1] === 2 && slots[2] === null && slots[3] === null
  const orderChanged = isCompact && !isComplete

  const moveCrate = (from: number, to: number) => {
    if (from === to || slots[from] === null || slots[to] !== null) return
    setHistory((current) => [...current, slots])
    setSlots((current) => {
      const next = [...current]
      next[to] = next[from]
      next[from] = null
      return next
    })
    setSelectedIndex(null)
  }

  const handleSelect = (index: number) => {
    if (slots[index] !== null) {
      setSelectedIndex((current) => (current === index ? null : index))
      return
    }
    if (selectedIndex !== null) moveCrate(selectedIndex, index)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const source = event.active.data.current?.index as number | undefined
    setActiveValue(source === undefined ? null : slots[source])
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveValue(null)
    const from = event.active.data.current?.index as number | undefined
    const to = event.over?.data.current?.index as number | undefined
    if (from !== undefined && to !== undefined) moveCrate(from, to)
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setSlots(previous)
    setHistory((current) => current.slice(0, -1))
    setSelectedIndex(null)
  }

  const restart = () => {
    setSlots(initialSlots)
    setHistory([])
    setSelectedIndex(null)
  }

  return (
    <main className="manual-stage page-enter">
      <section className="manual-copy">
        <p className="eyebrow">入库校准 · 01</p>
        <h1>先亲手整理一批货</h1>
        <p className="mission-line">让货箱靠左，空位靠右；货箱的先后顺序不能改变。</p>
        <div className={`manual-status ${isComplete ? 'success' : orderChanged ? 'error' : ''}`} aria-live="polite">
          <span className="status-light" />
          <span>
            {isComplete
              ? '货位整理正确。'
              : orderChanged
                ? '货箱靠左了，但原有顺序发生了变化。'
                : selectedIndex === null
                  ? '选择或拖动一个货箱。'
                  : `已拿起货箱 ${slots[selectedIndex]}，选择一个空位。`}
          </span>
        </div>
      </section>

      <section className="manual-bay" aria-label="手动整理区">
        <div className="manual-rail" aria-hidden="true">
          <RobotGlyph className="manual-robot" />
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveValue(null)}
        >
          <div className="manual-slots">
            {slots.map((value, index) => (
              <ManualSlot
                key={index}
                index={index}
                value={value}
                selected={selectedIndex === index}
                onSelect={handleSelect}
              />
            ))}
          </div>
          <DragOverlay>
            {activeValue === null ? null : (
              <span className="crate crate-overlay"><span>{activeValue}</span></span>
            )}
          </DragOverlay>
        </DndContext>
        <div className="manual-actions">
          <button
            type="button"
            className="icon-button"
            onClick={undo}
            disabled={history.length === 0}
            aria-label="撤销上一步"
            title="撤销上一步"
          >
            <Undo2 size={19} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={restart}
            aria-label="重新整理"
            title="重新整理"
          >
            <RotateCcw size={19} />
          </button>
          {isComplete && (
            <button type="button" className="primary-command" onClick={onComplete}>
              <Bot size={20} />
              交给机器人
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
