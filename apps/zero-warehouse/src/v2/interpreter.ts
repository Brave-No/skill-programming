import type {
  FrameStatus,
  InterpretationResult,
  TraceFrame,
} from '../game/model'
import { validateSkillProgram } from './contracts'
import type { PositionReference, SkillInvocation } from './model'

const MAX_STEPS = 240

interface RuntimeContext {
  values: number[]
  originalValues: number[]
  scanStack: number[]
  writeIndex: number | null
  frames: TraceFrame[]
  halted: boolean
  error?: string
}

const currentScanIndex = (context: RuntimeContext) => context.scanStack.at(-1) ?? null

const compact = (values: number[]) => {
  const cargo = values.filter((value) => value !== 0)
  return [...cargo, ...Array(values.length - cargo.length).fill(0)]
}

const sameValues = (left: number[], right: number[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

const emit = (
  context: RuntimeContext,
  activeBlockId: string | null,
  message: string,
  changedIndices: number[] = [],
  status: FrameStatus = 'running',
) => {
  context.frames.push({
    id: context.frames.length,
    values: [...context.values],
    scanIndex: currentScanIndex(context),
    writeIndex: context.writeIndex,
    activeBlockId,
    changedIndices: [...new Set(changedIndices)],
    status,
    message,
  })

  if (context.frames.length > MAX_STEPS && !context.halted) {
    fail(context, activeBlockId, '规则执行的步骤过多，机器人已停止。')
  }
}

const fail = (context: RuntimeContext, activeBlockId: string | null, message: string) => {
  if (context.halted) return
  context.halted = true
  context.error = message
  emit(context, activeBlockId, message, [], 'error')
}

const resolvePosition = (
  reference: PositionReference,
  context: RuntimeContext,
): number | null =>
  reference === 'current-slot' ? currentScanIndex(context) : context.writeIndex

const executeNodes = (nodes: SkillInvocation[], context: RuntimeContext) => {
  for (const node of nodes) {
    if (context.halted) return

    switch (node.skillType) {
      case 'set-write': {
        context.writeIndex = node.config.targetIndex
        emit(context, node.instanceId, `装载标记已停在 ${node.config.targetIndex} 号货位。`)
        break
      }

      case 'for-each': {
        for (let index = 0; index < context.values.length; index += 1) {
          context.scanStack.push(index)
          emit(context, node.instanceId, `扫描臂来到 ${index} 号货位。`, [index])
          executeNodes(node.children, context)
          context.scanStack.pop()
          if (context.halted) return
        }
        emit(context, node.instanceId, '扫描臂已检查完所有货位。')
        break
      }

      case 'if-occupied': {
        const scanIndex = currentScanIndex(context)
        if (scanIndex === null) {
          fail(context, node.instanceId, '扫描尚未开始，机器人不知道要检查哪个货位。')
          return
        }
        const occupied = context.values[scanIndex] !== 0
        emit(
          context,
          node.instanceId,
          occupied ? '当前货位有货，进入这条规则。' : '当前货位是空位，跳过这条规则。',
          [scanIndex],
        )
        if (occupied) executeNodes(node.children, context)
        break
      }

      case 'swap': {
        const left = resolvePosition(node.config.left!, context)
        const right = resolvePosition(node.config.right!, context)
        if (left === null) {
          fail(context, node.instanceId, '第一个位置当前不存在。')
          return
        }
        if (right === null) {
          fail(context, node.instanceId, '第二个位置当前不存在。')
          return
        }
        if (
          left < 0 ||
          right < 0 ||
          left >= context.values.length ||
          right >= context.values.length
        ) {
          fail(context, node.instanceId, '要交换的位置已经越过仓库边界。')
          return
        }
        ;[context.values[left], context.values[right]] = [
          context.values[right],
          context.values[left],
        ]
        emit(
          context,
          node.instanceId,
          left === right
            ? `两个标记都在 ${left} 号位，货箱保持原位。`
            : `${left} 号位与 ${right} 号位完成交换。`,
          [left, right],
        )
        break
      }

      case 'advance-write': {
        if (context.writeIndex === null) {
          fail(context, node.instanceId, '装载标记还没有放入仓库。')
          return
        }
        if (context.writeIndex >= context.values.length) {
          fail(context, node.instanceId, '装载标记已经越过仓库边界。')
          return
        }
        context.writeIndex += 1
        emit(
          context,
          node.instanceId,
          context.writeIndex === context.values.length
            ? '装载标记已到达仓库末端。'
            : `装载标记前进到 ${context.writeIndex} 号货位。`,
        )
        break
      }
    }
  }
}

export const interpretSkillProgram = (
  program: SkillInvocation[],
  input: number[],
): InterpretationResult => {
  const context: RuntimeContext = {
    values: [...input],
    originalValues: [...input],
    scanStack: [],
    writeIndex: null,
    frames: [],
    halted: false,
  }

  emit(context, null, '机器人已读取规则，等待执行。', [], 'idle')

  const validation = validateSkillProgram(program)
  if (!validation.valid) {
    fail(context, validation.issues[0]?.instanceId ?? null, '规则还没有满足执行条件。')
  } else {
    executeNodes(program, context)
  }

  if (!context.halted) {
    const expected = compact(context.originalValues)
    const success = sameValues(context.values, expected)
    if (success) {
      emit(context, null, '本批货物整理完成。', [], 'success')
    } else {
      const originalCargo = context.originalValues.filter((value) => value !== 0)
      const finalCargo = context.values.filter((value) => value !== 0)
      const orderChanged = !sameValues(originalCargo, finalCargo)
      fail(
        context,
        null,
        orderChanged
          ? '货箱都还在，但原有的先后顺序发生了变化。'
          : '本批次结束了，但仍有货箱位于空位之后。',
      )
    }
  }

  return {
    frames: context.frames,
    success: !context.halted,
    finalValues: [...context.values],
    error: context.error,
  }
}
