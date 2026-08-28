import { Fragment, useMemo, useState, type ReactNode } from 'react'
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
  Blocks,
  CircleDotDashed,
  GripVertical,
  PlayCircle,
  Plus,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react'
import type { ChallengeSkillDefinition } from '../../challenges/types'

export interface SkillProgramNode<TType extends string = string> {
  id: string
  type: TType
  children: SkillProgramNode<TType>[]
}

export interface SkillProgramBuilderLabels {
  ariaLabel: string
  shelfKicker: string
  shelfTitle: string
  programKicker: string
  programTitle: string
  rootScope: string
  nestedScope: string
  clearProgram: string
  emptyProgram: string
}

interface SkillProgramBuilderProps<
  TType extends string,
  TNode extends SkillProgramNode<TType>,
  TSkill extends ChallengeSkillDefinition & { type: TType },
> {
  program: TNode[]
  activeNodeId: string | null
  disabled: boolean
  skills: TSkill[]
  labels: SkillProgramBuilderLabels
  createNode: (type: TType) => TNode
  renderSkillIcon?: (type: TType, size: number) => ReactNode
  onChange: (program: TNode[]) => void
  onClear: () => void
  onPreviewSkill?: (type: TType) => void
}

type Placement<TType extends string> =
  | { kind: 'new'; type: TType }
  | { kind: 'move'; id: string }

interface ParentLocation {
  scopeId: string
  index: number
}

const containsNode = <TType extends string, TNode extends SkillProgramNode<TType>>(
  node: TNode,
  id: string,
): boolean => node.id === id || node.children.some((child) => containsNode(child as TNode, id))

const findNode = <TType extends string, TNode extends SkillProgramNode<TType>>(
  nodes: TNode[],
  id: string,
): TNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    const nested = findNode(node.children as TNode[], id)
    if (nested) return nested
  }
  return null
}

const findParent = <TType extends string, TNode extends SkillProgramNode<TType>>(
  nodes: TNode[],
  id: string,
  scopeId = 'root',
): ParentLocation | null => {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) return { scopeId, index }
  for (const node of nodes) {
    const nested = findParent(node.children as TNode[], id, node.id)
    if (nested) return nested
  }
  return null
}

const insertNode = <TType extends string, TNode extends SkillProgramNode<TType>>(
  nodes: TNode[],
  scopeId: string,
  index: number,
  node: TNode,
): TNode[] => {
  if (scopeId === 'root') {
    const next = [...nodes]
    next.splice(index, 0, node)
    return next
  }
  return nodes.map((candidate) => {
    if (candidate.id === scopeId) {
      const children = [...candidate.children] as TNode[]
      children.splice(index, 0, node)
      return { ...candidate, children } as TNode
    }
    return {
      ...candidate,
      children: insertNode(candidate.children as TNode[], scopeId, index, node),
    } as TNode
  })
}

const removeNode = <TType extends string, TNode extends SkillProgramNode<TType>>(
  nodes: TNode[],
  id: string,
): { nodes: TNode[]; removed: TNode | null } => {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) {
    const next = [...nodes]
    const [removed] = next.splice(index, 1)
    return { nodes: next, removed }
  }
  let removed: TNode | null = null
  const next = nodes.map((node) => {
    if (removed) return node
    const nested = removeNode(node.children as TNode[], id)
    if (!nested.removed) return node
    removed = nested.removed
    return { ...node, children: nested.nodes } as TNode
  })
  return { nodes: next, removed }
}

const collisionStrategy: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

function DefaultSkillIcon({ size }: { size: number }) {
  return <Blocks size={size} />
}

interface ShelfSkillProps<TType extends string, TSkill extends ChallengeSkillDefinition & { type: TType }> {
  definition: TSkill
  disabled: boolean
  selected: boolean
  renderSkillIcon?: (type: TType, size: number) => ReactNode
  onSelect: () => void
  onPreview: () => void
}

function ShelfSkill<TType extends string, TSkill extends ChallengeSkillDefinition & { type: TType }>({
  definition,
  disabled,
  selected,
  renderSkillIcon,
  onSelect,
  onPreview,
}: ShelfSkillProps<TType, TSkill>) {
  const draggable = useDraggable({
    id: `new:${definition.type}`,
    data: { kind: 'new', type: definition.type },
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
        <span className="skill-icon">
          {renderSkillIcon?.(definition.type, 18) ?? <DefaultSkillIcon size={18} />}
        </span>
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
          onClick={(event) => { event.stopPropagation(); onPreview() }}
          disabled={disabled}
          aria-label={`预演技能：${definition.label}`}
          title="预演技能"
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
  nestedScopeLabel,
  onPlace,
}: {
  scopeId: string
  index: number
  placementActive: boolean
  blocked: boolean
  nestedScopeLabel: string
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
      aria-label={`${scopeId === 'root' ? '主流程' : nestedScopeLabel}第 ${index + 1} 个放置位置`}
    >
      <span><Plus size={13} /> 放在这里</span>
    </button>
  )
}

interface ProgramSkillProps<
  TType extends string,
  TNode extends SkillProgramNode<TType>,
  TSkill extends ChallengeSkillDefinition & { type: TType },
> {
  node: TNode
  definitionByType: Map<TType, TSkill>
  activeNodeId: string | null
  disabled: boolean
  placement: Placement<TType> | null
  nestedScopeLabel: string
  renderSkillIcon?: (type: TType, size: number) => ReactNode
  onSelectMove: (id: string) => void
  onDelete: (id: string) => void
  onPlace: (scopeId: string, index: number) => void
}

function ProgramSkill<
  TType extends string,
  TNode extends SkillProgramNode<TType>,
  TSkill extends ChallengeSkillDefinition & { type: TType },
>({
  node,
  definitionByType,
  activeNodeId,
  disabled,
  placement,
  nestedScopeLabel,
  renderSkillIcon,
  onSelectMove,
  onDelete,
  onPlace,
}: ProgramSkillProps<TType, TNode, TSkill>) {
  const definition = definitionByType.get(node.type)!
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
        <span className="skill-icon">
          {renderSkillIcon?.(node.type, 18) ?? <DefaultSkillIcon size={18} />}
        </span>
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
          <div className="scope-caption"><Repeat2 size={14} /> {nestedScopeLabel}</div>
          {(node.children as TNode[]).map((child, index) => (
            <Fragment key={child.id}>
              <DropSlot
                scopeId={node.id}
                index={index}
                placementActive={placement !== null}
                blocked={scopeBlocked}
                nestedScopeLabel={nestedScopeLabel}
                onPlace={() => onPlace(node.id, index)}
              />
              <ProgramSkill
                node={child}
                definitionByType={definitionByType}
                activeNodeId={activeNodeId}
                disabled={disabled}
                placement={placement}
                nestedScopeLabel={nestedScopeLabel}
                renderSkillIcon={renderSkillIcon}
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
            nestedScopeLabel={nestedScopeLabel}
            onPlace={() => onPlace(node.id, node.children.length)}
          />
        </div>
      )}
    </article>
  )
}

export function SkillProgramBuilder<
  TType extends string,
  TNode extends SkillProgramNode<TType>,
  TSkill extends ChallengeSkillDefinition & { type: TType },
>({
  program,
  activeNodeId,
  disabled,
  skills,
  labels,
  createNode,
  renderSkillIcon,
  onChange,
  onClear,
  onPreviewSkill,
}: SkillProgramBuilderProps<TType, TNode, TSkill>) {
  const [placement, setPlacement] = useState<Placement<TType> | null>(null)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )
  const definitionByType = useMemo(
    () => new Map(skills.map((definition) => [definition.type, definition])),
    [skills],
  )
  const selectedType = placement?.kind === 'new' ? placement.type : null
  const movingNode = useMemo(
    () => placement?.kind === 'move' ? findNode(program, placement.id) : null,
    [placement, program],
  )

  const place = (scopeId: string, index: number, explicitPlacement = placement) => {
    if (!explicitPlacement || disabled) return
    if (explicitPlacement.kind === 'new') {
      onChange(insertNode(program, scopeId, index, createNode(explicitPlacement.type)))
      setPlacement(null)
      return
    }
    const source = findParent(program, explicitPlacement.id)
    const removal = removeNode(program, explicitPlacement.id)
    if (!removal.removed || containsNode(removal.removed, scopeId)) return
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
    const data = event.active.data.current as Placement<TType> | undefined
    if (!data) return
    setPlacement(data)
    const type = data.kind === 'new' ? data.type : findNode(program, data.id)?.type
    setDragLabel(type ? definitionByType.get(type)?.label ?? null : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as Placement<TType> | undefined
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
      onDragCancel={() => { setPlacement(null); setDragLabel(null) }}
      onDragEnd={handleDragEnd}
    >
      <section className="builder" aria-label={labels.ariaLabel}>
        <div className="builder-section-heading">
          <div><span className="section-kicker">{labels.shelfKicker}</span><h2>{labels.shelfTitle}</h2></div>
          {placement && (
            <button type="button" className="icon-button" onClick={() => setPlacement(null)} aria-label="取消放置" title="取消放置">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="skill-shelf">
          {skills.map((definition) => (
            <ShelfSkill
              key={definition.type}
              definition={definition}
              disabled={disabled}
              selected={selectedType === definition.type}
              renderSkillIcon={renderSkillIcon}
              onPreview={() => onPreviewSkill?.(definition.type)}
              onSelect={() => setPlacement(
                selectedType === definition.type ? null : { kind: 'new', type: definition.type },
              )}
            />
          ))}
        </div>

        <div className="builder-section-heading builder-section-heading--program">
          <div><span className="section-kicker">{labels.programKicker}</span><h2>{labels.programTitle}</h2></div>
          <button type="button" className="icon-button" onClick={onClear} disabled={disabled || program.length === 0} aria-label={labels.clearProgram} title={labels.clearProgram}>
            <Trash2 size={17} />
          </button>
        </div>

        <div className="program-scope program-scope--root" data-scope="root">
          <div className="scope-caption"><CircleDotDashed size={14} /> {labels.rootScope}</div>
          {program.map((node, index) => (
            <Fragment key={node.id}>
              <DropSlot scopeId="root" index={index} placementActive={placement !== null} blocked={false} nestedScopeLabel={labels.nestedScope} onPlace={() => place('root', index)} />
              <ProgramSkill
                node={node}
                definitionByType={definitionByType}
                activeNodeId={activeNodeId}
                disabled={disabled}
                placement={placement}
                nestedScopeLabel={labels.nestedScope}
                renderSkillIcon={renderSkillIcon}
                onSelectMove={(id) => setPlacement(
                  placement?.kind === 'move' && placement.id === id ? null : { kind: 'move', id },
                )}
                onDelete={deleteNode}
                onPlace={place}
              />
            </Fragment>
          ))}
          <DropSlot scopeId="root" index={program.length} placementActive={placement !== null} blocked={Boolean(movingNode && containsNode(movingNode, 'root'))} nestedScopeLabel={labels.nestedScope} onPlace={() => place('root', program.length)} />
          {program.length === 0 && placement === null && (
            <div className="empty-program"><Plus size={20} /> {labels.emptyProgram}</div>
          )}
        </div>
      </section>
      <DragOverlay>{dragLabel ? <div className="drag-overlay"><GripVertical size={16} />{dragLabel}</div> : null}</DragOverlay>
    </DndContext>
  )
}
