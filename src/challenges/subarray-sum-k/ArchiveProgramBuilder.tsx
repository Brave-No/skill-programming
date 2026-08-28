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
  Archive,
  CircleDotDashed,
  Database,
  GripVertical,
  ListRestart,
  PlayCircle,
  Plus,
  Repeat2,
  Sigma,
  Trash2,
  X,
} from 'lucide-react'
import {
  ARCHIVE_SKILLS,
  createArchiveSkillNode,
  findArchiveSkillNode,
  getArchiveSkill,
  insertArchiveSkillNode,
  removeArchiveSkillNode,
  type ArchiveSkillNode,
  type ArchiveSkillType,
} from './model'

interface ArchiveProgramBuilderProps {
  program: ArchiveSkillNode[]
  activeNodeId: string | null
  disabled: boolean
  onChange: (program: ArchiveSkillNode[]) => void
  onClear: () => void
  onPreviewSkill: (type: ArchiveSkillType) => void
}

type Placement = { kind: 'new'; type: ArchiveSkillType } | { kind: 'move'; id: string }

const collisionStrategy: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

const containsNode = (node: ArchiveSkillNode, id: string): boolean =>
  node.id === id || node.children.some((child) => containsNode(child, id))

const findParent = (nodes: ArchiveSkillNode[], id: string, scopeId = 'root'): { scopeId: string; index: number } | null => {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) return { scopeId, index }
  for (const node of nodes) {
    const nested = findParent(node.children, id, node.id)
    if (nested) return nested
  }
  return null
}

function SkillGlyph({ type, size = 18 }: { type: ArchiveSkillType; size?: number }) {
  switch (type) {
    case 'initialize-archive': return <Archive size={size} />
    case 'scan-values': return <Repeat2 size={size} />
    case 'accumulate-prefix': return <Sigma size={size} />
    case 'count-matches': return <Database size={size} />
    case 'record-prefix': return <ListRestart size={size} />
  }
}

function ShelfSkill({ type, disabled, selected, onSelect, onPreview }: {
  type: ArchiveSkillType
  disabled: boolean
  selected: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  const definition = getArchiveSkill(type)
  const draggable = useDraggable({ id: `new:${type}`, data: { kind: 'new', type }, disabled })
  return (
    <article ref={draggable.setNodeRef} className={`shelf-skill tone-${definition.tone} ${selected ? 'is-selected' : ''} ${draggable.isDragging ? 'is-dragging' : ''}`} style={{ transform: DndCSS.Translate.toString(draggable.transform) }}>
      <button type="button" className="shelf-skill__select" onClick={onSelect} disabled={disabled} aria-label={`取用技能：${definition.label}`} {...draggable.listeners} {...draggable.attributes}>
        <span className="skill-icon"><SkillGlyph type={type} /></span>
        <span className="skill-copy"><strong>{definition.label}</strong><small>{definition.logicPurpose}</small></span>
      </button>
      <span className="skill-intro-actions">
        <button type="button" className="skill-intro-trigger" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPreview() }} disabled={disabled} aria-label={`预演技能：${definition.label}`} title="预演技能"><PlayCircle size={18} /></button>
        <button type="button" className="icon-button skill-add-button" onClick={onSelect} disabled={disabled} aria-label={`选择技能：${definition.label}`} title="选择放置位置"><Plus size={18} /></button>
      </span>
    </article>
  )
}

function DropSlot({ scopeId, index, active, blocked, onPlace }: {
  scopeId: string
  index: number
  active: boolean
  blocked: boolean
  onPlace: () => void
}) {
  const droppable = useDroppable({ id: `archive-drop:${scopeId}:${index}`, data: { scopeId, index }, disabled: blocked })
  return (
    <button ref={droppable.setNodeRef} type="button" className={`program-drop-slot ${active ? 'is-ready' : ''} ${droppable.isOver ? 'is-over' : ''}`} onClick={onPlace} disabled={!active || blocked} aria-label={`${scopeId === 'root' ? '主流程' : '逐项巡查'}第 ${index + 1} 个放置位置`}>
      <span><Plus size={13} />放在这里</span>
    </button>
  )
}

function ProgramSkill({ node, activeNodeId, disabled, placement, onSelectMove, onDelete, onPlace }: {
  node: ArchiveSkillNode
  activeNodeId: string | null
  disabled: boolean
  placement: Placement | null
  onSelectMove: (id: string) => void
  onDelete: (id: string) => void
  onPlace: (scopeId: string, index: number) => void
}) {
  const definition = getArchiveSkill(node.type)
  const draggable = useDraggable({ id: `move:${node.id}`, data: { kind: 'move', id: node.id }, disabled })
  const movingId = placement?.kind === 'move' ? placement.id : null
  const blocked = movingId === node.id
  return (
    <article ref={draggable.setNodeRef} className={`program-skill tone-${definition.tone} ${activeNodeId === node.id ? 'is-active' : ''} ${movingId === node.id ? 'is-selected' : ''}`} style={{ transform: DndCSS.Translate.toString(draggable.transform) }} data-program-node={node.id}>
      <div className="program-skill__header">
        <button type="button" className="drag-handle" onClick={() => onSelectMove(node.id)} disabled={disabled} aria-label={`移动技能：${definition.label}`} title="拖动或选择新位置" {...draggable.listeners} {...draggable.attributes}><GripVertical size={17} /></button>
        <span className="skill-icon"><SkillGlyph type={node.type} /></span>
        <span className="program-skill__title">{definition.label}</span>
        <button type="button" className="icon-button" onClick={() => onDelete(node.id)} disabled={disabled} aria-label={`删除技能：${definition.label}`} title="删除技能"><Trash2 size={16} /></button>
      </div>
      {definition.createsScope && (
        <div className="program-scope program-scope--nested" data-scope={node.id}>
          <div className="scope-caption"><Repeat2 size={14} />每一站</div>
          {node.children.map((child, index) => (
            <Fragment key={child.id}>
              <DropSlot scopeId={node.id} index={index} active={placement !== null} blocked={blocked} onPlace={() => onPlace(node.id, index)} />
              <ProgramSkill node={child} activeNodeId={activeNodeId} disabled={disabled} placement={placement} onSelectMove={onSelectMove} onDelete={onDelete} onPlace={onPlace} />
            </Fragment>
          ))}
          <DropSlot scopeId={node.id} index={node.children.length} active={placement !== null} blocked={blocked} onPlace={() => onPlace(node.id, node.children.length)} />
        </div>
      )}
    </article>
  )
}

export default function ArchiveProgramBuilder({ program, activeNodeId, disabled, onChange, onClear, onPreviewSkill }: ArchiveProgramBuilderProps) {
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )
  const selectedType = placement?.kind === 'new' ? placement.type : null
  const movingNode = useMemo(() => placement?.kind === 'move' ? findArchiveSkillNode(program, placement.id) : null, [placement, program])

  const place = (scopeId: string, index: number, explicit = placement) => {
    if (!explicit || disabled) return
    if (explicit.kind === 'new') {
      onChange(insertArchiveSkillNode(program, scopeId, createArchiveSkillNode(explicit.type), index))
      setPlacement(null)
      return
    }
    const parent = findParent(program, explicit.id)
    const removal = removeArchiveSkillNode(program, explicit.id)
    if (!removal.removed || containsNode(removal.removed, scopeId)) return
    let target = index
    if (parent?.scopeId === scopeId && parent.index < index) target -= 1
    onChange(insertArchiveSkillNode(removal.nodes, scopeId, removal.removed, target))
    setPlacement(null)
  }

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as Placement | undefined
    if (!data) return
    setPlacement(data)
    setDragLabel(data.kind === 'new' ? getArchiveSkill(data.type).label : getArchiveSkill(findArchiveSkillNode(program, data.id)?.type ?? 'initialize-archive').label)
  }
  const onDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as Placement | undefined
    const target = event.over?.data.current as { scopeId: string; index: number } | undefined
    if (data && target) place(target.scopeId, target.index, data)
    setPlacement(null)
    setDragLabel(null)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collisionStrategy} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} onDragStart={onDragStart} onDragCancel={() => { setPlacement(null); setDragLabel(null) }} onDragEnd={onDragEnd}>
      <section className="builder archive-builder" aria-label="前缀档案技能编排器">
        <div className="builder-section-heading"><div><span className="section-kicker">技能架</span><h2>档案技能</h2></div>{placement && <button type="button" className="icon-button" onClick={() => setPlacement(null)} aria-label="取消放置" title="取消放置"><X size={18} /></button>}</div>
        <div className="skill-shelf">
          {ARCHIVE_SKILLS.map((skill) => <ShelfSkill key={skill.type} type={skill.type} disabled={disabled} selected={selectedType === skill.type} onPreview={() => onPreviewSkill(skill.type)} onSelect={() => setPlacement(selectedType === skill.type ? null : { kind: 'new', type: skill.type })} />)}
        </div>
        <div className="builder-section-heading builder-section-heading--program"><div><span className="section-kicker">执行顺序</span><h2>档案程序</h2></div><button type="button" className="icon-button" onClick={onClear} disabled={disabled || program.length === 0} aria-label="清空档案程序" title="清空档案程序"><Trash2 size={17} /></button></div>
        <div className="program-scope program-scope--root" data-scope="root">
          <div className="scope-caption"><CircleDotDashed size={14} />主流程</div>
          {program.map((node, index) => <Fragment key={node.id}><DropSlot scopeId="root" index={index} active={placement !== null} blocked={false} onPlace={() => place('root', index)} /><ProgramSkill node={node} activeNodeId={activeNodeId} disabled={disabled} placement={placement} onSelectMove={(id) => setPlacement(placement?.kind === 'move' && placement.id === id ? null : { kind: 'move', id })} onDelete={(id) => { onChange(removeArchiveSkillNode(program, id).nodes); if (placement?.kind === 'move' && placement.id === id) setPlacement(null) }} onPlace={place} /></Fragment>)}
          <DropSlot scopeId="root" index={program.length} active={placement !== null} blocked={Boolean(movingNode && containsNode(movingNode, 'root'))} onPlace={() => place('root', program.length)} />
          {program.length === 0 && placement === null && <div className="empty-program"><Plus size={20} />从技能架选择第一项</div>}
        </div>
      </section>
      <DragOverlay>{dragLabel ? <div className="drag-overlay"><GripVertical size={16} />{dragLabel}</div> : null}</DragOverlay>
    </DndContext>
  )
}
