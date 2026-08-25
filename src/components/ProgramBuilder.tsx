import { Fragment, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
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
import { CSS as DndCSS } from '@dnd-kit/utilities'
import {
  Anchor,
  BetweenHorizontalStart,
  CircleDotDashed,
  Droplets,
  GripVertical,
  Mountain,
  PlayCircle,
  Plus,
  Repeat2,
  ScanLine,
  Trash2,
  X,
} from 'lucide-react'
import {
  containsNode,
  createSkillNode,
  findNode,
  getSkillDefinition,
  insertNode,
  removeNode,
  type SkillNode,
  type SkillDefinition,
  type SkillType,
} from '../game/model'

interface ProgramBuilderProps {
  program: SkillNode[]
  activeNodeId: string | null
  disabled: boolean
  skills: SkillDefinition[]
  onChange: (program: SkillNode[]) => void
  onClear: () => void
  onPreviewSkill?: (type: SkillType) => void
}

type Placement =
  | { kind: 'new'; type: SkillType }
  | { kind: 'move'; id: string }

interface ParentLocation {
  scopeId: string
  index: number
}

const findParent = (
  nodes: SkillNode[],
  id: string,
  scopeId = 'root',
): ParentLocation | null => {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) return { scopeId, index }
  for (const node of nodes) {
    const nested = findParent(node.children, id, node.id)
    if (nested) return nested
  }
  return null
}

const collisionStrategy: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

function SkillIcon({ type, size = 18 }: { type: SkillType; size?: number }) {
  switch (type) {
    case 'deploy':
      return <Anchor size={size} />
    case 'patrol':
      return <Repeat2 size={size} />
    case 'compare':
      return <ScanLine size={size} />
    case 'collect':
      return <Droplets size={size} />
    case 'advance':
      return <BetweenHorizontalStart size={size} />
    case 'update-max':
      return <Mountain size={size} />
  }
}

function ShelfSkill({
  type,
  disabled,
  selected,
  onSelect,
  onPreview,
}: {
  type: SkillType
  disabled: boolean
  selected: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  const definition = getSkillDefinition(type)
  const draggable = useDraggable({
    id: `new:${type}`,
    data: { kind: 'new', type },
    disabled,
  })

  return (
    <article
      ref={draggable.setNodeRef}
      className={`shelf-skill tone-${definition.tone} ${selected ? 'is-selected' : ''} ${draggable.isDragging ? 'is-dragging' : ''}`}
      style={{ transform: DndCSS.Translate.toString(draggable.transform) }}
      data-concept-ids={definition.conceptIds.join(' ')}
    >
      <button
        type="button"
        className="shelf-skill__select"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`取用技能：${definition.label}`}
        {...draggable.listeners}
        {...draggable.attributes}
      >
        <span className="skill-icon"><SkillIcon type={type} /></span>
        <span className="skill-copy">
          <strong>{definition.label}</strong>
          <small>{definition.description}</small>
        </span>
      </button>
      <span className="skill-intro-actions">
        <button
          type="button"
          className="skill-intro-trigger"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onPreview()
          }}
          disabled={disabled}
          aria-label={`播放技能介绍短片：${definition.label}`}
          title="播放技能介绍短片"
        >
          <PlayCircle size={18} />
        </button>
        <button
          type="button"
          className="icon-button skill-add-button"
          onClick={onSelect}
          disabled={disabled}
          aria-label={`选择技能：${definition.label}`}
          title={`选择“${definition.label}”的放置位置`}
        >
          <Plus size={18} />
        </button>
      </span>
    </article>
  )
}

function DropSlot({
  scopeId,
  index,
  placementActive,
  blocked,
  onPlace,
}: {
  scopeId: string
  index: number
  placementActive: boolean
  blocked: boolean
  onPlace: () => void
}) {
  const droppable = useDroppable({
    id: `drop:${scopeId}:${index}`,
    data: { scopeId, index },
    disabled: blocked,
  })

  return (
    <button
      ref={droppable.setNodeRef}
      type="button"
      className={`program-drop-slot ${placementActive ? 'is-ready' : ''} ${droppable.isOver ? 'is-over' : ''}`}
      onClick={onPlace}
      disabled={!placementActive || blocked}
      aria-label={`${scopeId === 'root' ? '主流程' : '巡检循环'}第 ${index + 1} 个放置位置`}
    >
      <span><Plus size={13} /> 放在这里</span>
    </button>
  )
}

function ProgramSkill({
  node,
  activeNodeId,
  disabled,
  placement,
  onSelectMove,
  onDelete,
  onPlace,
}: {
  node: SkillNode
  activeNodeId: string | null
  disabled: boolean
  placement: Placement | null
  onSelectMove: (id: string) => void
  onDelete: (id: string) => void
  onPlace: (scopeId: string, index: number) => void
}) {
  const definition = getSkillDefinition(node.type)
  const draggable = useDraggable({
    id: `move:${node.id}`,
    data: { kind: 'move', id: node.id },
    disabled,
  })
  const movingNode = placement?.kind === 'move' ? placement.id : null
  const scopeBlocked = movingNode ? containsNode(node, movingNode) : false

  return (
    <article
      ref={draggable.setNodeRef}
      className={`program-skill tone-${definition.tone} ${activeNodeId === node.id ? 'is-active' : ''} ${placement?.kind === 'move' && placement.id === node.id ? 'is-selected' : ''} ${draggable.isDragging ? 'is-dragging' : ''}`}
      style={{ transform: DndCSS.Translate.toString(draggable.transform) }}
      data-program-node={node.id}
      data-concept-ids={definition.conceptIds.join(' ')}
    >
      <div className="program-skill__header">
        <button
          type="button"
          className="drag-handle"
          onClick={() => onSelectMove(node.id)}
          disabled={disabled}
          aria-label={`移动技能：${definition.label}`}
          title="拖动或点击后选择新的位置"
          {...draggable.listeners}
          {...draggable.attributes}
        >
          <GripVertical size={17} />
        </button>
        <span className="skill-icon"><SkillIcon type={node.type} /></span>
        <span className="program-skill__title">{definition.label}</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(node.id)}
          disabled={disabled}
          aria-label={`删除技能：${definition.label}`}
          title="删除技能"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {definition.createsScope && (
        <div className="program-scope program-scope--nested" data-scope={node.id}>
          <div className="scope-caption"><Repeat2 size={14} /> 每一轮</div>
          {node.children.map((child, index) => (
            <Fragment key={child.id}>
              <DropSlot
                scopeId={node.id}
                index={index}
                placementActive={placement !== null}
                blocked={scopeBlocked}
                onPlace={() => onPlace(node.id, index)}
              />
              <ProgramSkill
                node={child}
                activeNodeId={activeNodeId}
                disabled={disabled}
                placement={placement}
                onSelectMove={onSelectMove}
                onDelete={onDelete}
                onPlace={onPlace}
              />
            </Fragment>
          ))}
          <DropSlot
            scopeId={node.id}
            index={node.children.length}
            placementActive={placement !== null}
            blocked={scopeBlocked}
            onPlace={() => onPlace(node.id, node.children.length)}
          />
        </div>
      )}
    </article>
  )
}

export default function ProgramBuilder({
  program,
  activeNodeId,
  disabled,
  skills,
  onChange,
  onClear,
  onPreviewSkill,
}: ProgramBuilderProps) {
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )

  const selectedType = placement?.kind === 'new' ? placement.type : null
  const movingNode = useMemo(
    () => (placement?.kind === 'move' ? findNode(program, placement.id) : null),
    [placement, program],
  )

  const place = (scopeId: string, index: number, explicitPlacement = placement) => {
    if (!explicitPlacement || disabled) return

    if (explicitPlacement.kind === 'new') {
      onChange(insertNode(program, scopeId, index, createSkillNode(explicitPlacement.type)))
      setPlacement(null)
      return
    }

    const source = findParent(program, explicitPlacement.id)
    const removal = removeNode(program, explicitPlacement.id)
    if (!removal.removed) return
    if (containsNode(removal.removed, scopeId)) return

    let targetIndex = index
    if (source?.scopeId === scopeId && source.index < index) targetIndex -= 1
    onChange(insertNode(removal.nodes, scopeId, targetIndex, removal.removed))
    setPlacement(null)
  }

  const deleteNode = (id: string) => {
    onChange(removeNode(program, id).nodes)
    if (placement?.kind === 'move' && placement.id === id) setPlacement(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as Placement | undefined
    if (!data) return
    setPlacement(data)
    setDragLabel(
      data.kind === 'new'
        ? getSkillDefinition(data.type).label
        : getSkillDefinition(findNode(program, data.id)?.type ?? 'deploy').label,
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as Placement | undefined
    const target = event.over?.data.current as { scopeId: string; index: number } | undefined
    if (data && target) place(target.scopeId, target.index, data)
    setPlacement(null)
    setDragLabel(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragCancel={() => {
        setPlacement(null)
        setDragLabel(null)
      }}
      onDragEnd={handleDragEnd}
    >
      <section className="builder" aria-label="双指针技能编排器">
        <div className="builder-section-heading">
          <div>
            <span className="section-kicker">技能架</span>
            <h2>巡检技能</h2>
          </div>
          {placement && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setPlacement(null)}
              aria-label="取消放置"
              title="取消放置"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="skill-shelf">
          {skills.map((definition) => (
            <ShelfSkill
              key={definition.type}
              type={definition.type}
              disabled={disabled}
              selected={selectedType === definition.type}
              onPreview={() => onPreviewSkill?.(definition.type)}
              onSelect={() =>
                setPlacement(
                  selectedType === definition.type ? null : { kind: 'new', type: definition.type },
                )
              }
            />
          ))}
        </div>

        <div className="builder-section-heading builder-section-heading--program">
          <div>
            <span className="section-kicker">执行顺序</span>
            <h2>巡检程序</h2>
          </div>
          <div className="builder-actions">
            <button
              type="button"
              className="icon-button"
              onClick={onClear}
              disabled={disabled || program.length === 0}
              aria-label="清空巡检程序"
              title="清空巡检程序"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>

        <div className="program-scope program-scope--root" data-scope="root">
          <div className="scope-caption"><CircleDotDashed size={14} /> 主流程</div>
          {program.map((node, index) => (
            <Fragment key={node.id}>
              <DropSlot
                scopeId="root"
                index={index}
                placementActive={placement !== null}
                blocked={movingNode ? containsNode(movingNode, 'root') : false}
                onPlace={() => place('root', index)}
              />
              <ProgramSkill
                node={node}
                activeNodeId={activeNodeId}
                disabled={disabled}
                placement={placement}
                onSelectMove={(id) =>
                  setPlacement(
                    placement?.kind === 'move' && placement.id === id
                      ? null
                      : { kind: 'move', id },
                  )
                }
                onDelete={deleteNode}
                onPlace={place}
              />
            </Fragment>
          ))}
          <DropSlot
            scopeId="root"
            index={program.length}
            placementActive={placement !== null}
            blocked={false}
            onPlace={() => place('root', program.length)}
          />
          {program.length === 0 && placement === null && (
            <div className="empty-program"><Plus size={20} /> 从技能架选择第一项</div>
          )}
        </div>
      </section>

      <DragOverlay>
        {dragLabel ? <div className="drag-overlay"><GripVertical size={16} />{dragLabel}</div> : null}
      </DragOverlay>
    </DndContext>
  )
}
