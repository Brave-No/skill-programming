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
  BadgePlus,
  BookOpenCheck,
  Brackets,
  CircleDotDashed,
  Eye,
  Gauge,
  GripVertical,
  PanelLeftClose,
  PlayCircle,
  Plus,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react'
import {
  WINDOW_SKILLS,
  createWindowSkillNode,
  getWindowSkill,
  type WindowSkillNode,
  type WindowSkillType,
} from '../model'

interface WindowProgramBuilderProps {
  program: WindowSkillNode[]
  activeNodeId: string | null
  disabled: boolean
  onChange: (program: WindowSkillNode[]) => void
  onClear: () => void
  onPreviewSkill: (type: WindowSkillType) => void
}

type Placement =
  | { kind: 'new'; type: WindowSkillType }
  | { kind: 'move'; id: string }

interface DropTarget {
  scopeId?: string
  index?: number
  shelf?: boolean
}

const collisionStrategy: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

const containsNode = (node: WindowSkillNode, id: string): boolean =>
  node.id === id || node.children.some((child) => containsNode(child, id))

const findNode = (nodes: WindowSkillNode[], id: string): WindowSkillNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    const nested = findNode(node.children, id)
    if (nested) return nested
  }
  return null
}

const findParent = (
  nodes: WindowSkillNode[],
  id: string,
  scopeId = 'root',
): { scopeId: string; index: number } | null => {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) return { scopeId, index }
  for (const node of nodes) {
    const nested = findParent(node.children, id, node.id)
    if (nested) return nested
  }
  return null
}

const removeNode = (
  nodes: WindowSkillNode[],
  id: string,
): { nodes: WindowSkillNode[]; removed: WindowSkillNode | null } => {
  let removed: WindowSkillNode | null = null
  const next = nodes.flatMap((node) => {
    if (node.id === id) {
      removed = node
      return []
    }
    const nested = removeNode(node.children, id)
    if (nested.removed) removed = nested.removed
    return [{ ...node, children: nested.nodes }]
  })
  return { nodes: next, removed }
}

const insertNode = (
  nodes: WindowSkillNode[],
  scopeId: string,
  index: number,
  node: WindowSkillNode,
): WindowSkillNode[] => {
  if (scopeId === 'root') {
    const next = [...nodes]
    next.splice(index, 0, node)
    return next
  }
  return nodes.map((current) => current.id === scopeId
    ? {
        ...current,
        children: [
          ...current.children.slice(0, index),
          node,
          ...current.children.slice(index),
        ],
      }
    : { ...current, children: insertNode(current.children, scopeId, index, node) })
}

function SkillGlyph({ type, size = 18 }: { type: WindowSkillType; size?: number }) {
  switch (type) {
    case 'initialize': return <CircleDotDashed size={size} />
    case 'scan': return <Repeat2 size={size} />
    case 'shrink-duplicates': return <PanelLeftClose size={size} />
    case 'admit-current': return <BadgePlus size={size} />
    case 'update-best': return <Gauge size={size} />
  }
}

function ShelfSkill({
  type,
  disabled,
  selected,
  onSelect,
  onPreview,
}: {
  type: WindowSkillType
  disabled: boolean
  selected: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  const definition = getWindowSkill(type)
  const draggable = useDraggable({
    id: `window-new:${type}`,
    data: { kind: 'new', type },
    disabled,
  })

  return (
    <article
      ref={draggable.setNodeRef}
      className={`corridor-shelf-skill tone-${definition.tone} ${selected ? 'is-selected' : ''} ${draggable.isDragging ? 'is-dragging' : ''}`}
      style={{ transform: DndCSS.Translate.toString(draggable.transform) }}
      data-concept-ids={definition.conceptIds.join(' ')}
    >
      <button
        type="button"
        className="corridor-shelf-skill__main"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`取用技能：${definition.label}`}
        {...draggable.listeners}
        {...draggable.attributes}
      >
        <span><SkillGlyph type={type} /></span>
        <div><strong>{definition.label}</strong><small>{definition.description}</small></div>
      </button>
      <div className="corridor-shelf-skill__actions">
        <button type="button" onClick={onPreview} disabled={disabled} aria-label={`预演技能：${definition.label}`} title="预演技能"><PlayCircle size={17} /></button>
        <button type="button" onClick={onSelect} disabled={disabled} aria-label={`选择技能：${definition.label}`} title="选择放置位置"><Plus size={17} /></button>
      </div>
    </article>
  )
}

function DropSlot({
  scopeId,
  index,
  active,
  blocked,
  scopeLabel,
  onPlace,
}: {
  scopeId: string
  index: number
  active: boolean
  blocked: boolean
  scopeLabel: string
  onPlace: () => void
}) {
  const droppable = useDroppable({
    id: `window-drop:${scopeId}:${index}`,
    data: { scopeId, index },
    disabled: blocked,
  })
  return (
    <button
      ref={droppable.setNodeRef}
      type="button"
      className={`corridor-drop-slot ${active ? 'is-ready' : ''} ${droppable.isOver ? 'is-over' : ''}`}
      disabled={!active || blocked}
      onClick={onPlace}
      aria-label={`${scopeLabel}第 ${index + 1} 个放置位置`}
    >
      <span><Plus size={12} />放在这里</span>
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
  node: WindowSkillNode
  activeNodeId: string | null
  disabled: boolean
  placement: Placement | null
  onSelectMove: (id: string) => void
  onDelete: (id: string) => void
  onPlace: (scopeId: string, index: number) => void
}) {
  const definition = getWindowSkill(node.type)
  const draggable = useDraggable({
    id: `window-move:${node.id}`,
    data: { kind: 'move', id: node.id },
    disabled,
  })
  const movingId = placement?.kind === 'move' ? placement.id : null
  const movingNode = movingId ? findNode([node], movingId) : null
  const scopeBlocked = Boolean(movingNode && containsNode(movingNode, node.id))
  const scopeLabel = node.type === 'shrink-duplicates' ? '重复收缩作用域' : '字符扫描作用域'

  return (
    <article
      ref={draggable.setNodeRef}
      className={`corridor-program-skill tone-${definition.tone} ${activeNodeId === node.id ? 'is-active' : ''} ${movingId === node.id ? 'is-selected' : ''} ${draggable.isDragging ? 'is-dragging' : ''}`}
      style={{ transform: DndCSS.Translate.toString(draggable.transform) }}
      data-program-node={node.id}
      data-skill-type={node.type}
      data-concept-ids={definition.conceptIds.join(' ')}
    >
      <div className="corridor-program-skill__header">
        <button
          type="button"
          className="corridor-icon-button corridor-drag-handle"
          onClick={() => onSelectMove(node.id)}
          disabled={disabled}
          aria-label={`移动技能：${definition.label}`}
          title="拖动或点击后选择新位置"
          {...draggable.listeners}
          {...draggable.attributes}
        ><GripVertical size={16} /></button>
        <span className="corridor-skill-glyph"><SkillGlyph type={node.type} /></span>
        <strong>{definition.label}</strong>
        <button type="button" className="corridor-icon-button" onClick={() => onDelete(node.id)} disabled={disabled} aria-label={`删除技能：${definition.label}`} title="删除技能"><Trash2 size={15} /></button>
      </div>

      {definition.createsScope && (
        <div className={`corridor-program-scope is-nested scope-${node.type}`} data-scope={node.id}>
          <div className="corridor-scope-caption"><Brackets size={14} />{node.type === 'shrink-duplicates' ? '重复仍存在时' : '每个扫描字符'}</div>
          {node.children.map((child, index) => (
            <Fragment key={child.id}>
              <DropSlot scopeId={node.id} index={index} active={placement !== null} blocked={scopeBlocked} scopeLabel={scopeLabel} onPlace={() => onPlace(node.id, index)} />
              <ProgramSkill node={child} activeNodeId={activeNodeId} disabled={disabled} placement={placement} onSelectMove={onSelectMove} onDelete={onDelete} onPlace={onPlace} />
            </Fragment>
          ))}
          <DropSlot scopeId={node.id} index={node.children.length} active={placement !== null} blocked={scopeBlocked} scopeLabel={scopeLabel} onPlace={() => onPlace(node.id, node.children.length)} />
        </div>
      )}
    </article>
  )
}

function ShelfDrop({
  active,
  onReturn,
}: {
  active: boolean
  onReturn: () => void
}) {
  const droppable = useDroppable({
    id: 'window-shelf-return',
    data: { shelf: true },
    disabled: !active,
  })
  return (
    <button
      ref={droppable.setNodeRef}
      type="button"
      className={`corridor-shelf-return ${active ? 'is-ready' : ''} ${droppable.isOver ? 'is-over' : ''}`}
      onClick={onReturn}
      disabled={!active}
    >
      <BookOpenCheck size={16} />移回技能架
    </button>
  )
}

export default function WindowProgramBuilder({
  program,
  activeNodeId,
  disabled,
  onChange,
  onClear,
  onPreviewSkill,
}: WindowProgramBuilderProps) {
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )
  const selectedType = placement?.kind === 'new' ? placement.type : null
  const movingNode = useMemo(
    () => placement?.kind === 'move' ? findNode(program, placement.id) : null,
    [placement, program],
  )

  const place = (scopeId: string, index: number, explicit = placement) => {
    if (!explicit || disabled) return
    if (explicit.kind === 'new') {
      onChange(insertNode(program, scopeId, index, createWindowSkillNode(explicit.type)))
      setPlacement(null)
      return
    }
    const source = findParent(program, explicit.id)
    const removal = removeNode(program, explicit.id)
    if (!removal.removed || containsNode(removal.removed, scopeId)) return
    let targetIndex = index
    if (source?.scopeId === scopeId && source.index < index) targetIndex -= 1
    onChange(insertNode(removal.nodes, scopeId, targetIndex, removal.removed))
    setPlacement(null)
  }

  const returnToShelf = (id?: string) => {
    const nodeId = id ?? (placement?.kind === 'move' ? placement.id : null)
    if (!nodeId || disabled) return
    onChange(removeNode(program, nodeId).nodes)
    setPlacement(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as Placement | undefined
    if (!data) return
    setPlacement(data)
    const type = data.kind === 'new' ? data.type : findNode(program, data.id)?.type
    setDragLabel(type ? getWindowSkill(type).label : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as Placement | undefined
    const target = event.over?.data.current as DropTarget | undefined
    if (data?.kind === 'move' && target?.shelf) returnToShelf(data.id)
    else if (data && target?.scopeId !== undefined && target.index !== undefined) {
      place(target.scopeId, target.index, data)
    }
    setPlacement(null)
    setDragLabel(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragCancel={() => { setPlacement(null); setDragLabel(null) }}
      onDragEnd={handleDragEnd}
    >
      <section className="corridor-builder" aria-label="滑动窗口技能编排器">
        <header className="corridor-builder__heading">
          <div><span>02 技能认识</span><h2>窗口技能架</h2></div>
          {placement && <button type="button" className="corridor-icon-button" onClick={() => setPlacement(null)} aria-label="取消放置" title="取消放置"><X size={17} /></button>}
        </header>
        <div className="corridor-skill-shelf">
          {WINDOW_SKILLS.map((skill) => (
            <ShelfSkill
              key={skill.type}
              type={skill.type}
              disabled={disabled}
              selected={selectedType === skill.type}
              onPreview={() => onPreviewSkill(skill.type)}
              onSelect={() => setPlacement(selectedType === skill.type ? null : { kind: 'new', type: skill.type })}
            />
          ))}
        </div>

        <header className="corridor-builder__heading corridor-builder__heading--program">
          <div><span>03 规则编排</span><h2>窗口程序</h2></div>
          <div>
            <ShelfDrop active={placement?.kind === 'move'} onReturn={() => returnToShelf()} />
            <button type="button" className="corridor-icon-button" onClick={onClear} disabled={disabled || program.length === 0} aria-label="清空窗口程序" title="清空窗口程序"><Trash2 size={16} /></button>
          </div>
        </header>

        <div className="corridor-program-scope is-root" data-scope="root">
          <div className="corridor-scope-caption"><CircleDotDashed size={14} />主流程</div>
          {program.map((node, index) => (
            <Fragment key={node.id}>
              <DropSlot scopeId="root" index={index} active={placement !== null} blocked={false} scopeLabel="主流程" onPlace={() => place('root', index)} />
              <ProgramSkill
                node={node}
                activeNodeId={activeNodeId}
                disabled={disabled}
                placement={placement}
                onSelectMove={(id) => setPlacement(placement?.kind === 'move' && placement.id === id ? null : { kind: 'move', id })}
                onDelete={(id) => returnToShelf(id)}
                onPlace={place}
              />
            </Fragment>
          ))}
          <DropSlot scopeId="root" index={program.length} active={placement !== null} blocked={Boolean(movingNode && containsNode(movingNode, 'root'))} scopeLabel="主流程" onPlace={() => place('root', program.length)} />
          {program.length === 0 && placement === null && (
            <div className="corridor-empty-program"><Eye size={19} /><span>程序从空白开始</span><small>从技能架选择第一项，再决定它进入哪个作用域。</small></div>
          )}
        </div>
      </section>
      <DragOverlay>{dragLabel ? <div className="corridor-drag-overlay"><GripVertical size={16} />{dragLabel}</div> : null}</DragOverlay>
    </DndContext>
  )
}
