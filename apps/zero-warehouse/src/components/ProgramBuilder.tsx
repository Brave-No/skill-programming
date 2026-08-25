import { Fragment, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Braces,
  ChevronRight,
  GripVertical,
  PackageMinus,
  PackageOpen,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  BLOCK_DEFINITIONS,
  collectNodeIds,
  createBlock,
  getDefinition,
  type BlockNode,
} from '../game/model'

interface ProgramBuilderProps {
  program: BlockNode[]
  activeBlockId: string | null
  disabled: boolean
  onChange: (program: BlockNode[]) => void
  onClear: () => void
}

interface ParentInfo {
  containerId: string
  index: number
}

const findNode = (nodes: BlockNode[], id: string): BlockNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = findNode(node.children, id)
    if (child) return child
  }
  return null
}

const findParent = (
  nodes: BlockNode[],
  id: string,
  containerId = 'root',
): ParentInfo | null => {
  const directIndex = nodes.findIndex((node) => node.id === id)
  if (directIndex >= 0) return { containerId, index: directIndex }
  for (const node of nodes) {
    const found = findParent(node.children, id, node.id)
    if (found) return found
  }
  return null
}

const removeNode = (
  nodes: BlockNode[],
  id: string,
): { nodes: BlockNode[]; removed: BlockNode | null } => {
  let removed: BlockNode | null = null
  const next: BlockNode[] = []
  for (const node of nodes) {
    if (node.id === id) {
      removed = node
      continue
    }
    const childResult = removeNode(node.children, id)
    if (childResult.removed) removed = childResult.removed
    next.push({ ...node, children: childResult.nodes })
  }
  return { nodes: next, removed }
}

const insertNode = (
  nodes: BlockNode[],
  containerId: string,
  node: BlockNode,
  index: number,
): BlockNode[] => {
  if (containerId === 'root') {
    const next = [...nodes]
    next.splice(index, 0, node)
    return next
  }
  return nodes.map((item) => {
    if (item.id === containerId) {
      const nextChildren = [...item.children]
      nextChildren.splice(index, 0, node)
      return { ...item, children: nextChildren }
    }
    return { ...item, children: insertNode(item.children, containerId, node, index) }
  })
}

const collisionStrategy: CollisionDetection = (args) => {
  if (args.pointerCoordinates) {
    const elements = document.elementsFromPoint(
      args.pointerCoordinates.x,
      args.pointerCoordinates.y,
    )
    const directTarget = elements.find(
      (element) => element instanceof HTMLElement && element.dataset.dropId,
    ) as HTMLElement | undefined
    if (directTarget?.dataset.dropId) {
      const droppableContainer = args.droppableContainers.find(
        (container) => String(container.id) === directTarget.dataset.dropId,
      )
      if (droppableContainer) {
        return [{ id: droppableContainer.id, data: { droppableContainer, value: 1 } }]
      }
    }
  }
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

interface InsertionSlotProps {
  containerId: string
  index: number
  ready: boolean
  blocked: boolean
  empty: boolean
  onPlace: (containerId: string, index: number) => void
}

function InsertionSlot({
  containerId,
  index,
  ready,
  blocked,
  empty,
  onPlace,
}: InsertionSlotProps) {
  const disabled = !ready || blocked
  const id = `insert:${containerId}:${index}`
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { kind: 'insert', containerId, index },
    disabled,
  })
  const containerName =
    containerId === 'root'
      ? '主规则'
      : BLOCK_DEFINITIONS.find((definition) => definition.id === containerId)?.shortLabel ?? '内部规则'

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`v1-insertion-slot ${ready ? 'is-ready' : ''} ${
        isOver ? 'is-over' : ''
      } ${blocked ? 'is-blocked' : ''} ${empty ? 'is-empty' : ''}`}
      data-container={containerId}
      data-index={index}
      data-drop-id={id}
      onClick={() => onPlace(containerId, index)}
      disabled={disabled}
      aria-label={`放到${containerName}的第 ${index + 1} 个位置`}
      title={ready && !blocked ? '放到这里' : undefined}
    >
      <span className="v1-slot-plus"><Plus size={14} /></span>
      <span className="v1-slot-line" />
      {empty && <span className="v1-empty-label">规则从这里开始</span>}
    </button>
  )
}

interface RuleListProps {
  nodes: BlockNode[]
  containerId: string
  movingId: string | null
  activeBlockId: string | null
  selectedId: string | null
  disabled: boolean
  blockedContainers: Set<string>
  onSelect: (id: string) => void
  onReturn: (id: string) => void
  onPlace: (containerId: string, index: number) => void
}

function RuleList({
  nodes,
  containerId,
  movingId,
  activeBlockId,
  selectedId,
  disabled,
  blockedContainers,
  onSelect,
  onReturn,
  onPlace,
}: RuleListProps) {
  const ready = Boolean(movingId) && !disabled
  return (
    <div className={`v1-rule-list ${containerId === 'root' ? 'is-root' : 'is-nested'}`}>
      {nodes.map((node, index) => (
        <Fragment key={node.id}>
          <InsertionSlot
            containerId={containerId}
            index={index}
            ready={ready}
            blocked={blockedContainers.has(containerId)}
            empty={false}
            onPlace={onPlace}
          />
          <RuleBlock
            node={node}
            movingId={movingId}
            activeBlockId={activeBlockId}
            selectedId={selectedId}
            disabled={disabled}
            blockedContainers={blockedContainers}
            onSelect={onSelect}
            onReturn={onReturn}
            onPlace={onPlace}
          />
        </Fragment>
      ))}
      <InsertionSlot
        containerId={containerId}
        index={nodes.length}
        ready={ready}
        blocked={blockedContainers.has(containerId)}
        empty={nodes.length === 0}
        onPlace={onPlace}
      />
    </div>
  )
}

function RuleBlock({
  node,
  movingId,
  activeBlockId,
  selectedId,
  disabled,
  blockedContainers,
  onSelect,
  onReturn,
  onPlace,
}: Omit<RuleListProps, 'nodes' | 'containerId'> & { node: BlockNode }) {
  const definition = getDefinition(node.type)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.id,
    data: { kind: 'program-block', nodeId: node.id },
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={`v1-block ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <article
        className={`v1-block-card tone-${definition.tone} ${
          activeBlockId === node.id ? 'is-active' : ''
        } ${selectedId === node.id ? 'is-selected' : ''}`}
      >
        <button
          type="button"
          className="v1-drag-handle"
          aria-label={`拖动：${definition.label}`}
          title="拖动积木"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>
        <button
          type="button"
          className="v1-block-select"
          onClick={() => onSelect(node.id)}
          aria-pressed={selectedId === node.id}
        >
          <span className="v1-block-shape" aria-hidden="true">
            {definition.acceptsChildren ? <Braces size={17} /> : <ChevronRight size={17} />}
          </span>
          <span>{definition.label}</span>
        </button>
        <button
          type="button"
          className="v1-return-button"
          onClick={() => onReturn(node.id)}
          aria-label={`将${definition.label}放回工具架`}
          title="放回工具架"
        >
          <PackageMinus size={16} />
        </button>
      </article>
      {definition.acceptsChildren && (
        <div className="v1-block-children">
          <RuleList
            nodes={node.children}
            containerId={node.id}
            movingId={movingId}
            activeBlockId={activeBlockId}
            selectedId={selectedId}
            disabled={disabled}
            blockedContainers={blockedContainers}
            onSelect={onSelect}
            onReturn={onReturn}
            onPlace={onPlace}
          />
        </div>
      )}
    </div>
  )
}

function ShelfBlock({
  id,
  label,
  tone,
  selected,
  disabled,
  onSelect,
}: {
  id: string
  label: string
  tone: string
  selected: boolean
  disabled: boolean
  onSelect: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { kind: 'shelf-block', nodeId: id },
    disabled,
  })
  return (
    <div
      ref={setNodeRef}
      className={`v1-shelf-block tone-${tone} ${selected ? 'is-selected' : ''} ${
        isDragging ? 'is-dragging' : ''
      }`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <button
        type="button"
        className="v1-shelf-handle"
        aria-label={`拖动：${label}`}
        title="拖动积木"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={17} />
      </button>
      <button
        type="button"
        className="v1-shelf-select"
        onClick={() => onSelect(id)}
        aria-pressed={selected}
      >
        {label}
      </button>
    </div>
  )
}

export function ProgramBuilderV1({
  program,
  activeBlockId,
  disabled,
  onChange,
  onClear,
}: ProgramBuilderProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const usedIds = useMemo(() => new Set(collectNodeIds(program)), [program])
  const shelf = BLOCK_DEFINITIONS.filter((definition) => !usedIds.has(definition.id))
  const movingId = draggedId ?? selectedId
  const movingNode = movingId
    ? findNode(program, movingId) ??
      (() => {
        const definition = BLOCK_DEFINITIONS.find((item) => item.id === movingId)
        return definition ? createBlock(definition.type) : null
      })()
    : null
  const blockedContainers = useMemo(
    () => new Set(movingNode ? collectNodeIds([movingNode]) : []),
    [movingNode],
  )
  const movingDefinition = movingId
    ? BLOCK_DEFINITIONS.find((definition) => definition.id === movingId)
    : null

  const { setNodeRef: setShelfRef, isOver: shelfIsOver } = useDroppable({
    id: 'return:shelf',
    data: { kind: 'shelf' },
    disabled: !draggedId || !findNode(program, draggedId),
  })

  const placeNode = (nodeId: string, containerId: string, requestedIndex: number) => {
    const existing = findNode(program, nodeId)
    const definition = BLOCK_DEFINITIONS.find((item) => item.id === nodeId)
    const moving = existing ?? (definition ? createBlock(definition.type) : null)
    if (!moving || collectNodeIds([moving]).includes(containerId)) return

    const sourceParent = existing ? findParent(program, nodeId) : null
    const removed = removeNode(program, nodeId)
    let targetIndex = requestedIndex
    if (
      sourceParent &&
      sourceParent.containerId === containerId &&
      sourceParent.index < requestedIndex
    ) {
      targetIndex -= 1
    }

    const containerNode = containerId === 'root' ? null : findNode(removed.nodes, containerId)
    if (containerNode && !getDefinition(containerNode.type).acceptsChildren) return

    onChange(insertNode(removed.nodes, containerId, moving, targetIndex))
    setSelectedId(null)
  }

  const returnToShelf = (id: string) => {
    const removed = removeNode(program, id)
    if (removed.removed) onChange(removed.nodes)
    if (
      selectedId === id ||
      (removed.removed && collectNodeIds([removed.removed]).includes(selectedId ?? ''))
    ) {
      setSelectedId(null)
    }
  }

  const selectBlock = (id: string) => {
    if (disabled) return
    setSelectedId((current) => (current === id ? null : id))
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(String(event.active.id))
    setSelectedId(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    setDraggedId(null)
    if (disabled || !event.over) return
    const overData = event.over.data.current
    if (overData?.kind === 'shelf') {
      returnToShelf(activeId)
      return
    }
    if (overData?.kind === 'insert') {
      placeNode(activeId, String(overData.containerId), Number(overData.index))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggedId(null)}
    >
      <div className={`program-builder v1-builder ${disabled ? 'is-locked' : ''}`}>
        <section className="v1-tool-shelf" aria-label="规则积木工具架">
          <div className="v1-panel-heading">
            <div>
              <p className="panel-kicker">可用动作</p>
              <h2>工具架</h2>
            </div>
            <span className="item-count">{shelf.length}</span>
          </div>
          <div
            ref={setShelfRef}
            className={`v1-shelf-list ${shelfIsOver ? 'is-over' : ''}`}
            data-drop-id="return:shelf"
          >
            {shelf.length === 0 ? (
              <div className="v1-shelf-empty">
                <PackageOpen size={21} />
                <span>动作已全部取出</span>
              </div>
            ) : (
              shelf.map((definition) => (
                <ShelfBlock
                  key={definition.id}
                  id={definition.id}
                  label={definition.label}
                  tone={definition.tone}
                  selected={selectedId === definition.id}
                  disabled={disabled}
                  onSelect={selectBlock}
                />
              ))
            )}
          </div>
          {selectedId && movingDefinition && (
            <div className="v1-selection-bar" role="status">
              <span className={`v1-selection-swatch tone-${movingDefinition.tone}`} />
              <span>{movingDefinition.shortLabel}</span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="取消选择"
                title="取消选择"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </section>

        <section className="v1-rule-stack" aria-label="机器人执行规则">
          <div className="v1-panel-heading">
            <div>
              <p className="panel-kicker">从上到下执行</p>
              <h2>机器人规则</h2>
            </div>
            <button
              type="button"
              className="icon-button small"
              onClick={onClear}
              disabled={disabled || program.length === 0}
              aria-label="清空规则"
              title="清空规则"
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className={`v1-program-surface ${movingId ? 'is-placing' : ''}`}>
            <RuleList
              nodes={program}
              containerId="root"
              movingId={movingId}
              activeBlockId={activeBlockId}
              selectedId={selectedId}
              disabled={disabled}
              blockedContainers={blockedContainers}
              onSelect={selectBlock}
              onReturn={returnToShelf}
              onPlace={(containerId, index) => {
                if (selectedId) placeNode(selectedId, containerId, index)
              }}
            />
          </div>
        </section>
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {movingDefinition && draggedId ? (
          <div className={`v1-drag-preview tone-${movingDefinition.tone}`}>
            <GripVertical size={17} />
            <span>{movingDefinition.label}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
