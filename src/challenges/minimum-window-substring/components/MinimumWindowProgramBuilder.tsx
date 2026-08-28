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
  BookOpen,
  Braces,
  GitBranch,
  GripVertical,
  ListRestart,
  Plus,
  Repeat2,
  ScanLine,
  Trash2,
  X,
} from 'lucide-react'
import {
  MINIMUM_WINDOW_SKILLS,
  containsMinimumWindowNode,
  createMinimumWindowSkillNode,
  findMinimumWindowNode,
  getMinimumWindowSkill,
  insertMinimumWindowNode,
  removeMinimumWindowNode,
  type MinimumWindowSkillNode,
  type MinimumWindowSkillType,
} from '../model'

interface MinimumWindowProgramBuilderProps {
  program: MinimumWindowSkillNode[]
  activeNodeId: string | null
  disabled: boolean
  onChange: (program: MinimumWindowSkillNode[]) => void
  onPreview: (type: MinimumWindowSkillType) => void
}

type Placement =
  | { kind: 'new'; type: MinimumWindowSkillType }
  | { kind: 'move'; id: string }

interface ParentLocation {
  scopeId: string
  index: number
}

const findParent = (
  nodes: MinimumWindowSkillNode[],
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

const skillGroup = (type: MinimumWindowSkillType) => {
  if (type === 'initialize-window') return '目标登记'
  if (type === 'scan-source' || type === 'read-incoming-character') return '窗口扩张'
  return '覆盖收缩'
}

const scopeLabel: Partial<Record<MinimumWindowSkillType, string>> = {
  'scan-source': '每个源字符',
  'shrink-covered-window': '完整覆盖时',
}

function SkillGlyph({ type }: { type: MinimumWindowSkillType }) {
  if (type === 'scan-source' || type === 'shrink-covered-window') {
    return <Repeat2 size={16} />
  }
  if (type.startsWith('read-')) return <ScanLine size={16} />
  if (type === 'initialize-window') return <ListRestart size={16} />
  return <Braces size={16} />
}

function ShelfSkill({
  type,
  disabled,
  selected,
  onSelect,
  onPreview,
}: {
  type: MinimumWindowSkillType
  disabled: boolean
  selected: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  const definition = getMinimumWindowSkill(type)
  const draggable = useDraggable({ id: `new:${type}`, data: { kind: 'new', type }, disabled })
  return (
    <article
      ref={draggable.setNodeRef}
      className={`mw-shelf-skill tone-${definition.tone} ${selected ? 'is-selected' : ''} ${draggable.isDragging ? 'is-dragging' : ''}`}
      style={{ transform: DndCSS.Translate.toString(draggable.transform) }}
      data-concept-ids={definition.conceptIds.join(' ')}
    >
      <button
        type="button"
        className="mw-shelf-skill__pick"
        onClick={onSelect}
        disabled={disabled}
        {...draggable.listeners}
        {...draggable.attributes}
      >
        <span><SkillGlyph type={type} /></span>
        <strong>{definition.shortLabel}</strong>
      </button>
      <button
        type="button"
        className="mw-shelf-skill__preview"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onPreview() }}
        disabled={disabled}
        aria-label={`查看技能：${definition.label}`}
        title="查看技能"
      >
        <BookOpen size={15} />
      </button>
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
    id: `mw-drop:${scopeId}:${index}`,
    data: { kind: 'slot', scopeId, index },
    disabled: blocked,
  })
  return (
    <button
      ref={droppable.setNodeRef}
      type="button"
      className={`mw-drop-slot ${placementActive ? 'is-ready' : ''} ${droppable.isOver ? 'is-over' : ''}`}
      onClick={onPlace}
      disabled={!placementActive || blocked}
      aria-label={`${scopeId === 'root' ? '主流程' : '嵌套作用域'}第 ${index + 1} 个放置位置`}
    >
      <span><Plus size={12} /> 放在这里</span>
    </button>
  )
}

function ProgramNode({
  node,
  placement,
  activeNodeId,
  disabled,
  onPlace,
  onMove,
  onDelete,
}: {
  node: MinimumWindowSkillNode
  placement: Placement | null
  activeNodeId: string | null
  disabled: boolean
  onPlace: (scopeId: string, index: number) => void
  onMove: (id: string) => void
  onDelete: (id: string) => void
}) {
  const definition = getMinimumWindowSkill(node.type)
  const draggable = useDraggable({ id: `move:${node.id}`, data: { kind: 'move', id: node.id }, disabled })
  const movingId = placement?.kind === 'move' ? placement.id : null
  const blocksOwnScope = movingId ? containsMinimumWindowNode(node, movingId) : false
  return (
    <article
      ref={draggable.setNodeRef}
      className={`mw-program-node tone-${definition.tone} ${activeNodeId === node.id ? 'is-active' : ''} ${movingId === node.id ? 'is-selected' : ''}`}
      style={{ transform: DndCSS.Translate.toString(draggable.transform) }}
      data-program-node={node.id}
      data-concept-ids={definition.conceptIds.join(' ')}
    >
      <header>
        <button
          type="button"
          className="mw-node-grip"
          onClick={() => onMove(node.id)}
          disabled={disabled}
          {...draggable.listeners}
          {...draggable.attributes}
          aria-label={`移动技能：${definition.label}`}
          title="拖动或点选移动"
        >
          <GripVertical size={15} />
        </button>
        <span><SkillGlyph type={node.type} /></span>
        <strong>{definition.shortLabel}</strong>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          disabled={disabled}
          aria-label={`移回技能架：${definition.label}`}
          title="移回技能架"
        >
          <Trash2 size={14} />
        </button>
      </header>
      {definition.createsScope && (
        <div className="mw-program-scope" data-scope={node.id}>
          <small><GitBranch size={12} /> {scopeLabel[node.type]}</small>
          {node.children.map((child, index) => (
            <Fragment key={child.id}>
              <DropSlot
                scopeId={node.id}
                index={index}
                placementActive={placement !== null}
                blocked={blocksOwnScope}
                onPlace={() => onPlace(node.id, index)}
              />
              <ProgramNode
                node={child}
                placement={placement}
                activeNodeId={activeNodeId}
                disabled={disabled}
                onPlace={onPlace}
                onMove={onMove}
                onDelete={onDelete}
              />
            </Fragment>
          ))}
          <DropSlot
            scopeId={node.id}
            index={node.children.length}
            placementActive={placement !== null}
            blocked={blocksOwnScope}
            onPlace={() => onPlace(node.id, node.children.length)}
          />
        </div>
      )}
    </article>
  )
}

export default function MinimumWindowProgramBuilder({
  program,
  activeNodeId,
  disabled,
  onChange,
  onPreview,
}: MinimumWindowProgramBuilderProps) {
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )
  const movingNode = useMemo(
    () => placement?.kind === 'move' ? findMinimumWindowNode(program, placement.id) : null,
    [placement, program],
  )
  const rackDrop = useDroppable({
    id: 'mw-rack-drop',
    data: { kind: 'rack' },
    disabled: disabled || placement?.kind !== 'move',
  })

  const place = (scopeId: string, index: number, explicit = placement) => {
    if (!explicit || disabled) return
    if (explicit.kind === 'new') {
      onChange(insertMinimumWindowNode(program, scopeId, index, createMinimumWindowSkillNode(explicit.type)))
      setPlacement(null)
      return
    }
    const source = findParent(program, explicit.id)
    const removal = removeMinimumWindowNode(program, explicit.id)
    if (!removal.removed || containsMinimumWindowNode(removal.removed, scopeId)) return
    const targetIndex = source?.scopeId === scopeId && source.index < index ? index - 1 : index
    onChange(insertMinimumWindowNode(removal.nodes, scopeId, targetIndex, removal.removed))
    setPlacement(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const next = event.active.data.current as Placement | undefined
    if (!next) return
    setPlacement(next)
    const type = next.kind === 'new' ? next.type : findMinimumWindowNode(program, next.id)?.type
    setDragLabel(type ? getMinimumWindowSkill(type).label : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const next = event.active.data.current as Placement | undefined
    const target = event.over?.data.current as { kind?: string; scopeId?: string; index?: number } | undefined
    if (next?.kind === 'move' && target?.kind === 'rack') {
      onChange(removeMinimumWindowNode(program, next.id).nodes)
    } else if (next && target?.scopeId !== undefined && target.index !== undefined) {
      place(target.scopeId, target.index, next)
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
      <section className="mw-builder" aria-label="最小覆盖子串技能编排器">
        <div className="mw-builder-heading">
          <div><span>技能架</span><h2>欠账窗口技能</h2></div>
          {placement && (
            <button type="button" onClick={() => setPlacement(null)} aria-label="取消放置" title="取消放置"><X size={17} /></button>
          )}
        </div>
        <div
          ref={rackDrop.setNodeRef}
          className={`mw-skill-rack ${rackDrop.isOver ? 'is-over' : ''}`}
        >
          {(['目标登记', '窗口扩张', '覆盖收缩'] as const).map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              <div>
                {MINIMUM_WINDOW_SKILLS.filter((skill) => skillGroup(skill.type) === group).map((skill) => (
                  <ShelfSkill
                    key={skill.type}
                    type={skill.type}
                    disabled={disabled}
                    selected={placement?.kind === 'new' && placement.type === skill.type}
                    onPreview={() => onPreview(skill.type)}
                    onSelect={() => setPlacement((current) => (
                      current?.kind === 'new' && current.type === skill.type
                        ? null
                        : { kind: 'new', type: skill.type }
                    ))}
                  />
                ))}
              </div>
            </section>
          ))}
          {placement?.kind === 'move' && <p className="mw-rack-return"><Trash2 size={14} /> 拖到技能架可移除</p>}
        </div>

        <div className="mw-builder-heading mw-builder-heading--program">
          <div><span>执行顺序</span><h2>窗口程序</h2></div>
          <button
            type="button"
            onClick={() => { onChange([]); setPlacement(null) }}
            disabled={disabled || program.length === 0}
            aria-label="清空窗口程序"
            title="清空窗口程序"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div className="mw-root-scope" data-scope="root">
          <small><Braces size={13} /> 主流程</small>
          {program.map((node, index) => (
            <Fragment key={node.id}>
              <DropSlot scopeId="root" index={index} placementActive={placement !== null} blocked={false} onPlace={() => place('root', index)} />
              <ProgramNode
                node={node}
                placement={placement}
                activeNodeId={activeNodeId}
                disabled={disabled}
                onPlace={place}
                onMove={(id) => setPlacement((current) => current?.kind === 'move' && current.id === id ? null : { kind: 'move', id })}
                onDelete={(id) => onChange(removeMinimumWindowNode(program, id).nodes)}
              />
            </Fragment>
          ))}
          <DropSlot scopeId="root" index={program.length} placementActive={placement !== null} blocked={Boolean(movingNode && containsMinimumWindowNode(movingNode, 'root'))} onPlace={() => place('root', program.length)} />
          {program.length === 0 && !placement && <div className="mw-empty-program"><Plus size={18} /> 从“初始化”开始搭建</div>}
        </div>
      </section>
      <DragOverlay>{dragLabel ? <div className="mw-drag-overlay"><GripVertical size={15} />{dragLabel}</div> : null}</DragOverlay>
    </DndContext>
  )
}
