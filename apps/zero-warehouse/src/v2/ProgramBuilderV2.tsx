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
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import {
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  GitBranch,
  GripVertical,
  Layers3,
  LocateFixed,
  MoveRight,
  PackagePlus,
  PlayCircle,
  Repeat2,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react'
import type { ContractIssue, ContractValidation } from './contracts'
import {
  CAPABILITY_LABELS,
  SKILL_DEFINITIONS,
  collectInvocationIds,
  createSkillInvocation,
  findInvocation,
  findInvocationParent,
  getSkillDefinition,
  insertInvocation,
  removeInvocation,
  replaceInvocation,
  type CapabilityId,
  type PositionReference,
  type SkillInvocation,
  type SkillType,
} from './model'

interface ProgramBuilderV2Props {
  program: SkillInvocation[]
  validation: ContractValidation
  activeInstanceId: string | null
  disabled: boolean
  onChange: (program: SkillInvocation[]) => void
  onClear: () => void
  onPreviewSkill?: (skillType: SkillType) => void
}

type PlacementSelection =
  | { kind: 'new'; skillType: SkillType }
  | { kind: 'move'; instanceId: string }

interface DragTarget {
  scopeId: string
  index: number
  blocked: boolean
}

const scopeCollisionStrategy: CollisionDetection = (args) => {
  if (args.pointerCoordinates) {
    const elements = document.elementsFromPoint(
      args.pointerCoordinates.x,
      args.pointerCoordinates.y,
    )

    for (const element of elements) {
      if (!(element instanceof HTMLElement)) continue
      const scopeElement = element.closest<HTMLElement>('[data-scope-id]')
      const scopeId = scopeElement?.dataset.scopeId
      if (!scopeId) continue
      const droppable = args.droppableContainers.find(
        (container) => String(container.id) === `scope:${scopeId}`,
      )
      if (droppable) {
        return [{ id: droppable.id, data: { droppableContainer: droppable, value: 1 } }]
      }
    }
  }

  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

const findScopeElement = (scopeId: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-scope-id]')).find(
    (element) => element.dataset.scopeId === scopeId,
  ) ?? null

const getInsertionIndex = (
  scopeId: string,
  centerY: number,
  movingInstanceId: string | null,
) => {
  const scopeElement = findScopeElement(scopeId)
  if (!scopeElement) return 0

  const items = Array.from(
    scopeElement.querySelectorAll<HTMLElement>(':scope > [data-scope-item]'),
  ).filter((item) => item.dataset.instanceId !== movingInstanceId)

  const beforeIndex = items.findIndex((item) => {
    const rect = item.getBoundingClientRect()
    return centerY < rect.top + rect.height / 2
  })
  return beforeIndex === -1 ? items.length : beforeIndex
}

const eventCenterY = (event: DragMoveEvent | DragEndEvent) => {
  const rect = event.active.rect.current.translated ?? event.active.rect.current.initial
  return rect ? rect.top + rect.height / 2 : 0
}

const SkillIcon = ({ skillType, size = 17 }: { skillType: SkillType; size?: number }) => {
  switch (skillType) {
    case 'set-write':
      return <LocateFixed size={size} />
    case 'for-each':
      return <Repeat2 size={size} />
    case 'if-occupied':
      return <GitBranch size={size} />
    case 'swap':
      return <Shuffle size={size} />
    case 'advance-write':
      return <MoveRight size={size} />
  }
}

const capabilityOptionLabel = (
  capability: CapabilityId,
  availableCapabilities: CapabilityId[],
) =>
  availableCapabilities.includes(capability)
    ? CAPABILITY_LABELS[capability]
    : `${CAPABILITY_LABELS[capability]}（此处不可用）`

function InlineSelect({
  value,
  label,
  invalid,
  disabled,
  onChange,
  children,
}: {
  value: string
  label: string
  invalid: boolean
  disabled: boolean
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      className={`v2-inline-select ${invalid ? 'is-invalid' : ''}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </select>
  )
}

function SkillConfiguration({
  node,
  issues,
  availableCapabilities,
  disabled,
  onUpdate,
}: {
  node: SkillInvocation
  issues: ContractIssue[]
  availableCapabilities: CapabilityId[]
  disabled: boolean
  onUpdate: (node: SkillInvocation) => void
}) {
  const invalidField = (field: string) =>
    issues.some((issue) => issue.field === field || issue.field === 'references')

  switch (node.skillType) {
    case 'set-write':
      return (
        <div className="v2-skill-sentence">
          <span>装载标记放到</span>
          <InlineSelect
            value={node.config.targetIndex?.toString() ?? ''}
            label="选择装载标记的货位"
            invalid={invalidField('targetIndex')}
            disabled={disabled}
            onChange={(value) =>
              onUpdate({
                ...node,
                config: { targetIndex: value === '' ? null : Number(value) },
              })
            }
          >
            <option value="">未选择</option>
            {[0, 1, 2, 3, 4].map((index) => (
              <option key={index} value={index}>{index} 号位</option>
            ))}
          </InlineSelect>
        </div>
      )

    case 'for-each':
      return (
        <div className="v2-skill-sentence">
          <span>遍历</span>
          <InlineSelect
            value={node.config.collection ?? ''}
            label="选择遍历对象"
            invalid={invalidField('collection')}
            disabled={disabled}
            onChange={(value) =>
              onUpdate({
                ...node,
                config: {
                  collection: value === 'warehouse-slots' ? 'warehouse-slots' : null,
                },
              })
            }
          >
            <option value="">未选择</option>
            <option value="warehouse-slots">仓库全部货位</option>
          </InlineSelect>
        </div>
      )

    case 'if-occupied':
      return (
        <div className="v2-skill-sentence">
          <span>如果</span>
          <InlineSelect
            value={node.config.subject ?? ''}
            label="选择判断对象"
            invalid={invalidField('subject')}
            disabled={disabled}
            onChange={(value) =>
              onUpdate({
                ...node,
                config: { subject: value === 'current-slot' ? 'current-slot' : null },
              })
            }
          >
            <option value="">未选择</option>
            <option value="current-slot">
              {capabilityOptionLabel('current-slot', availableCapabilities)}
            </option>
          </InlineSelect>
          <span>有货</span>
        </div>
      )

    case 'swap': {
      const positionOptions: PositionReference[] = ['current-slot', 'write-pointer']
      const updateReference = (field: 'left' | 'right', value: string) => {
        const reference = positionOptions.includes(value as PositionReference)
          ? (value as PositionReference)
          : null
        onUpdate({ ...node, config: { ...node.config, [field]: reference } })
      }
      return (
        <div className="v2-skill-sentence">
          <span>交换</span>
          <InlineSelect
            value={node.config.left ?? ''}
            label="选择第一个交换位置"
            invalid={invalidField('left')}
            disabled={disabled}
            onChange={(value) => updateReference('left', value)}
          >
            <option value="">未选择</option>
            {positionOptions.map((reference) => (
              <option key={reference} value={reference}>
                {capabilityOptionLabel(reference, availableCapabilities)}
              </option>
            ))}
          </InlineSelect>
          <span>与</span>
          <InlineSelect
            value={node.config.right ?? ''}
            label="选择第二个交换位置"
            invalid={invalidField('right')}
            disabled={disabled}
            onChange={(value) => updateReference('right', value)}
          >
            <option value="">未选择</option>
            {positionOptions.map((reference) => (
              <option key={reference} value={reference}>
                {capabilityOptionLabel(reference, availableCapabilities)}
              </option>
            ))}
          </InlineSelect>
        </div>
      )
    }

    case 'advance-write':
      return (
        <div className="v2-skill-sentence">
          <InlineSelect
            value={node.config.pointer ?? ''}
            label="选择要移动的标记"
            invalid={invalidField('pointer')}
            disabled={disabled}
            onChange={(value) =>
              onUpdate({
                ...node,
                config: { pointer: value === 'write-pointer' ? 'write-pointer' : null },
              })
            }
          >
            <option value="">未选择</option>
            <option value="write-pointer">
              {capabilityOptionLabel('write-pointer', availableCapabilities)}
            </option>
          </InlineSelect>
          <span>前进一步</span>
        </div>
      )
  }
}

function LibrarySkill({
  skillType,
  disabled,
  selected,
  onSelect,
  onPreview,
}: {
  skillType: SkillType
  disabled: boolean
  selected: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  const definition = getSkillDefinition(skillType)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library:${skillType}`,
    data: { kind: 'library', skillType },
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={`v2-library-skill tone-${definition.tone} ${
        selected ? 'is-selected' : ''
      } ${isDragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={{ transform: DndCSS.Translate.toString(transform) }}
    >
      <button
        type="button"
        className="v2-library-select"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`取用技能：${definition.label}`}
        {...attributes}
        {...listeners}
      >
        <span className="v2-library-icon"><SkillIcon skillType={skillType} /></span>
        <span>{definition.label}</span>
        <PackagePlus size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="v2-library-preview"
        onClick={onPreview}
        disabled={disabled}
        aria-label={`预演技能：${definition.label}`}
        title="预演技能"
      >
        <PlayCircle size={18} />
      </button>
    </div>
  )
}

interface ScopeListProps {
  nodes: SkillInvocation[]
  scopeId: string
  depth: number
  validation: ContractValidation
  issuesByInstance: Map<string, ContractIssue[]>
  activeInstanceId: string | null
  disabled: boolean
  selection: PlacementSelection | null
  dragTarget: DragTarget | null
  blockedScopeIds: Set<string>
  onSelectMove: (instanceId: string) => void
  onPlace: (scopeId: string, index: number) => void
  onDelete: (instanceId: string) => void
  onUpdate: (node: SkillInvocation) => void
}

function PlacementSlot({
  scopeId,
  index,
  visible,
  blocked,
  dragState,
  onPlace,
}: {
  scopeId: string
  index: number
  visible: boolean
  blocked: boolean
  dragState: 'none' | 'target' | 'blocked'
  onPlace: () => void
}) {
  return (
    <button
      type="button"
      className={`v2-placement-slot ${visible ? 'is-visible' : ''} is-${dragState}`}
      onClick={onPlace}
      disabled={!visible || blocked}
      tabIndex={visible && !blocked ? 0 : -1}
      aria-label={`放到当前作用域第 ${index + 1} 个位置`}
    >
      <span />
      {visible && <PackagePlus size={14} />}
      <span />
    </button>
  )
}

function ScopeList({
  nodes,
  scopeId,
  depth,
  validation,
  issuesByInstance,
  activeInstanceId,
  disabled,
  selection,
  dragTarget,
  blockedScopeIds,
  onSelectMove,
  onPlace,
  onDelete,
  onUpdate,
}: ScopeListProps) {
  const blocked = blockedScopeIds.has(scopeId)
  const { setNodeRef, isOver } = useDroppable({
    id: `scope:${scopeId}`,
    data: { kind: 'scope', scopeId, depth },
    disabled,
  })
  const capabilities = validation.scopeCapabilities[scopeId] ?? []
  const targetInScope = dragTarget?.scopeId === scopeId

  const slotState = (index: number): 'none' | 'target' | 'blocked' => {
    if (!targetInScope || dragTarget?.index !== index) return 'none'
    return dragTarget.blocked ? 'blocked' : 'target'
  }

  return (
    <div
      ref={setNodeRef}
      className={`v2-scope ${scopeId === 'root' ? 'is-root' : 'is-child'} ${
        isOver ? 'is-over' : ''
      } ${blocked && (selection || dragTarget) ? 'is-blocked' : ''}`}
      data-scope-id={scopeId}
      data-scope-depth={depth}
    >
      <div className="v2-context-bar">
        <Layers3 size={14} />
        <span>{scopeId === 'root' ? '主作用域' : '内部作用域'}</span>
        <div className="v2-capability-list">
          {capabilities.map((capability) => (
            <span key={capability}>{CAPABILITY_LABELS[capability]}</span>
          ))}
          {capabilities.length === 0 && <span className="is-empty">暂无可用能力</span>}
        </div>
      </div>

      {nodes.map((node, index) => (
        <Fragment key={node.instanceId}>
          <PlacementSlot
            scopeId={scopeId}
            index={index}
            visible={Boolean(selection)}
            blocked={blocked}
            dragState={slotState(index)}
            onPlace={() => onPlace(scopeId, index)}
          />
          <SkillCard
            node={node}
            parentScopeId={scopeId}
            depth={depth}
            validation={validation}
            issuesByInstance={issuesByInstance}
            activeInstanceId={activeInstanceId}
            disabled={disabled}
            selection={selection}
            dragTarget={dragTarget}
            blockedScopeIds={blockedScopeIds}
            onSelectMove={onSelectMove}
            onPlace={onPlace}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        </Fragment>
      ))}

      <PlacementSlot
        scopeId={scopeId}
        index={nodes.length}
        visible={Boolean(selection)}
        blocked={blocked}
        dragState={slotState(nodes.length)}
        onPlace={() => onPlace(scopeId, nodes.length)}
      />

      {nodes.length === 0 && !selection && !targetInScope && (
        <div className="v2-empty-scope">空作用域</div>
      )}
    </div>
  )
}

function SkillCard({
  node,
  parentScopeId,
  depth,
  validation,
  issuesByInstance,
  activeInstanceId,
  disabled,
  selection,
  dragTarget,
  blockedScopeIds,
  onSelectMove,
  onPlace,
  onDelete,
  onUpdate,
}: Omit<ScopeListProps, 'nodes' | 'scopeId'> & {
  node: SkillInvocation
  parentScopeId: string
}) {
  const definition = getSkillDefinition(node.skillType)
  const issues = issuesByInstance.get(node.instanceId) ?? []
  const availableCapabilities = validation.capabilitiesBefore[node.instanceId] ?? []
  const selected = selection?.kind === 'move' && selection.instanceId === node.instanceId
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `instance:${node.instanceId}`,
    data: { kind: 'invocation', instanceId: node.instanceId, skillType: node.skillType },
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={`v2-scope-item ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: DndCSS.Translate.toString(transform) }}
      data-scope-item
      data-instance-id={node.instanceId}
      data-parent-scope={parentScopeId}
      data-skill-instance={node.instanceId}
      tabIndex={-1}
    >
      <article
        className={`v2-skill-card tone-${definition.tone} ${
          issues.length > 0 ? 'has-issues' : ''
        } ${activeInstanceId === node.instanceId ? 'is-active' : ''} ${
          selected ? 'is-selected' : ''
        }`}
      >
        <div className="v2-card-toolbar">
          <button
            type="button"
            className="v2-drag-handle"
            onClick={() => onSelectMove(node.instanceId)}
            disabled={disabled}
            aria-label={`移动技能：${definition.label}`}
            title="拖动或点选移动"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>
          <span className="v2-card-icon" aria-hidden="true">
            <SkillIcon skillType={node.skillType} />
          </span>
          <span className="v2-card-type">{definition.shortLabel}</span>
          {definition.contract.createsScope && <Braces size={16} aria-label="容器技能" />}
          <button
            type="button"
            className="v2-delete-skill"
            onClick={() => onDelete(node.instanceId)}
            disabled={disabled}
            aria-label={`删除技能：${definition.label}`}
            title="删除技能"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <SkillConfiguration
          node={node}
          issues={issues}
          availableCapabilities={availableCapabilities}
          disabled={disabled}
          onUpdate={onUpdate}
        />

        {issues.length > 0 && (
          <div className="v2-card-issues" role="status">
            {issues.map((issue, index) => (
              <span key={`${issue.field}-${issue.code}-${index}`}>
                <CircleAlert size={13} />{issue.message}
              </span>
            ))}
          </div>
        )}
      </article>

      {definition.contract.createsScope && (
        <div className="v2-child-scope-shell">
          <ScopeList
            nodes={node.children}
            scopeId={node.instanceId}
            depth={depth + 1}
            validation={validation}
            issuesByInstance={issuesByInstance}
            activeInstanceId={activeInstanceId}
            disabled={disabled}
            selection={selection}
            dragTarget={dragTarget}
            blockedScopeIds={blockedScopeIds}
            onSelectMove={onSelectMove}
            onPlace={onPlace}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
  )
}

export function ProgramBuilderV2({
  program,
  validation,
  activeInstanceId,
  disabled,
  onChange,
  onClear,
  onPreviewSkill,
}: ProgramBuilderV2Props) {
  const [selection, setSelection] = useState<PlacementSelection | null>(null)
  const [dragged, setDragged] = useState<{
    skillType: SkillType
    instanceId: string | null
  } | null>(null)
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 110, tolerance: 9 } }),
    useSensor(KeyboardSensor),
  )

  const movingInstanceId =
    dragged?.instanceId ?? (selection?.kind === 'move' ? selection.instanceId : null)
  const blockedScopeIds = useMemo(() => {
    if (!movingInstanceId) return new Set<string>()
    const moving = findInvocation(program, movingInstanceId)
    return new Set(moving ? collectInvocationIds([moving]) : [])
  }, [movingInstanceId, program])

  const issuesByInstance = useMemo(() => {
    const map = new Map<string, ContractIssue[]>()
    for (const issue of validation.issues) {
      if (!issue.instanceId) continue
      map.set(issue.instanceId, [...(map.get(issue.instanceId) ?? []), issue])
    }
    return map
  }, [validation.issues])

  const place = (
    placement: PlacementSelection,
    scopeId: string,
    requestedIndex: number,
  ) => {
    if (placement.kind === 'new') {
      onChange(
        insertInvocation(
          program,
          scopeId,
          createSkillInvocation(placement.skillType),
          requestedIndex,
        ),
      )
      return
    }

    const moving = findInvocation(program, placement.instanceId)
    if (!moving || collectInvocationIds([moving]).includes(scopeId)) return

    const sourceParent = findInvocationParent(program, placement.instanceId)
    const removed = removeInvocation(program, placement.instanceId)
    if (!removed.removed) return

    let targetIndex = requestedIndex
    if (
      sourceParent?.scopeId === scopeId &&
      sourceParent.index < requestedIndex
    ) {
      targetIndex -= 1
    }
    onChange(insertInvocation(removed.nodes, scopeId, removed.removed, targetIndex))
  }

  const placeSelection = (scopeId: string, index: number) => {
    if (!selection || blockedScopeIds.has(scopeId)) return
    place(selection, scopeId, index)
    setSelection(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    const skillType = data?.skillType as SkillType | undefined
    if (!skillType) return
    setSelection(null)
    setDragged({
      skillType,
      instanceId: data?.kind === 'invocation' ? String(data.instanceId) : null,
    })
  }

  const resolveDragTarget = (event: DragMoveEvent | DragEndEvent) => {
    const scopeId = event.over?.data.current?.scopeId as string | undefined
    if (!scopeId) return null
    const instanceId = event.active.data.current?.instanceId as string | undefined
    const moving = instanceId ? findInvocation(program, instanceId) : null
    const blocked = Boolean(moving && collectInvocationIds([moving]).includes(scopeId))
    return {
      scopeId,
      index: getInsertionIndex(scopeId, eventCenterY(event), instanceId ?? null),
      blocked,
    }
  }

  const handleDragMove = (event: DragMoveEvent) => {
    setDragTarget(resolveDragTarget(event))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const target = resolveDragTarget(event) ?? dragTarget
    const data = event.active.data.current
    setDragged(null)
    setDragTarget(null)
    if (disabled || !target || target.blocked) return

    if (data?.kind === 'library') {
      place({ kind: 'new', skillType: data.skillType as SkillType }, target.scopeId, target.index)
    } else if (data?.kind === 'invocation') {
      place(
        { kind: 'move', instanceId: String(data.instanceId) },
        target.scopeId,
        target.index,
      )
    }
  }

  const deleteInvocation = (instanceId: string) => {
    const result = removeInvocation(program, instanceId)
    if (result.removed) onChange(result.nodes)
    if (
      selection?.kind === 'move' &&
      result.removed &&
      collectInvocationIds([result.removed]).includes(selection.instanceId)
    ) {
      setSelection(null)
    }
  }

  const focusFirstIssue = () => {
    const instanceId = validation.issues.find((issue) => issue.instanceId)?.instanceId
    if (!instanceId) return
    const element = document.querySelector<HTMLElement>(
      `[data-skill-instance="${instanceId}"]`,
    )
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element?.focus({ preventScroll: true })
  }

  const selectedSkillType =
    selection?.kind === 'new'
      ? selection.skillType
      : selection?.kind === 'move'
        ? findInvocation(program, selection.instanceId)?.skillType ?? null
        : null
  const overlaySkillType = dragged?.skillType ?? selectedSkillType

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={scopeCollisionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragged(null)
        setDragTarget(null)
      }}
    >
      <div className={`v2-builder ${disabled ? 'is-locked' : ''}`}>
        <section className="v2-skill-library" aria-label="基础技能架">
          <div className="v2-panel-heading">
            <div>
              <p className="panel-kicker">技能架</p>
              <h2>基础技能</h2>
            </div>
            <Repeat2 size={19} aria-hidden="true" />
          </div>
          <div className="v2-library-grid">
            {SKILL_DEFINITIONS.map((definition) => (
              <LibrarySkill
                key={definition.skillType}
                skillType={definition.skillType}
                disabled={disabled}
                selected={
                  selection?.kind === 'new' && selection.skillType === definition.skillType
                }
                onSelect={() =>
                  setSelection((current) =>
                    current?.kind === 'new' && current.skillType === definition.skillType
                      ? null
                      : { kind: 'new', skillType: definition.skillType },
                  )
                }
                onPreview={() => onPreviewSkill?.(definition.skillType)}
              />
            ))}
          </div>
        </section>

        <section className="v2-program-panel" aria-label="机器人执行规则">
          <div className="v2-panel-heading">
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

          {program.length === 0 ? (
            <div className="v2-contract-status is-idle" role="status">
              <Braces size={17} />
              <span>尚未开始编排</span>
            </div>
          ) : validation.valid ? (
            <div className="v2-contract-status is-valid" role="status">
              <CheckCircle2 size={17} />
              <span>规则可以执行</span>
            </div>
          ) : (
            <button
              type="button"
              className="v2-contract-status is-invalid"
              onClick={focusFirstIssue}
            >
              <CircleAlert size={17} />
              <span>{validation.issues.length} 处规则未满足</span>
              <ChevronRight size={16} />
            </button>
          )}

          {selection && overlaySkillType && (
            <div className="v2-selection-strip" role="status">
              <SkillIcon skillType={overlaySkillType} />
              <span>{getSkillDefinition(overlaySkillType).shortLabel}</span>
              <span>选择放置位置</span>
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label="取消放置"
                title="取消放置"
              >
                <X size={15} />
              </button>
            </div>
          )}

          <div className="v2-program-scroll">
            <ScopeList
              nodes={program}
              scopeId="root"
              depth={0}
              validation={validation}
              issuesByInstance={issuesByInstance}
              activeInstanceId={activeInstanceId}
              disabled={disabled}
              selection={selection}
              dragTarget={dragTarget}
              blockedScopeIds={blockedScopeIds}
              onSelectMove={(instanceId) =>
                setSelection((current) =>
                  current?.kind === 'move' && current.instanceId === instanceId
                    ? null
                    : { kind: 'move', instanceId },
                )
              }
              onPlace={placeSelection}
              onDelete={deleteInvocation}
              onUpdate={(node) => onChange(replaceInvocation(program, node))}
            />
          </div>
        </section>
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {dragged ? (
          <div className={`v2-drag-preview tone-${getSkillDefinition(dragged.skillType).tone}`}>
            <GripVertical size={17} />
            <SkillIcon skillType={dragged.skillType} />
            <span>{getSkillDefinition(dragged.skillType).label}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
