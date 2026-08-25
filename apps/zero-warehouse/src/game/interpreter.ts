import type {
  BlockNode,
  FrameStatus,
  InterpretationResult,
  TraceFrame,
} from './model'

const MAX_STEPS = 160

interface RuntimeContext {
  values: number[]
  originalValues: number[]
  scanIndex: number | null
  writeIndex: number | null
  frames: TraceFrame[]
  halted: boolean
  error?: string
}

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
    scanIndex: context.scanIndex,
    writeIndex: context.writeIndex,
    activeBlockId,
    changedIndices: [...new Set(changedIndices)],
    status,
    message,
  })

  if (context.frames.length > MAX_STEPS) {
    fail(context, activeBlockId, '规则执行的步骤过多，机器人已停止。')
  }
}

const fail = (context: RuntimeContext, activeBlockId: string | null, message: string) => {
  if (context.halted) return
  context.halted = true
  context.error = message
  emit(context, activeBlockId, message, [], 'error')
}

const executeNodes = (nodes: BlockNode[], context: RuntimeContext) => {
  for (const node of nodes) {
    if (context.halted) return

    switch (node.type) {
      case 'set-write': {
        context.writeIndex = 0
        emit(context, node.id, '装载标记已停在 0 号货位。')
        break
      }

      case 'for-each': {
        for (let index = 0; index < context.values.length; index += 1) {
          context.scanIndex = index
          emit(context, node.id, `扫描臂来到 ${index} 号货位。`, [index])
          executeNodes(node.children, context)
          if (context.halted) return
        }
        emit(context, node.id, '扫描臂已检查完所有货位。')
        break
      }

      case 'if-occupied': {
        if (context.scanIndex === null) {
          fail(context, node.id, '扫描尚未开始，机器人不知道要检查哪个货位。')
          return
        }
        const occupied = context.values[context.scanIndex] !== 0
        emit(
          context,
          node.id,
          occupied ? '扫描位有货，进入这条规则。' : '扫描位是空位，跳过这条规则。',
          [context.scanIndex],
        )
        if (occupied) executeNodes(node.children, context)
        break
      }

      case 'swap': {
        if (context.scanIndex === null) {
          fail(context, node.id, '扫描尚未开始，机器人没有可交换的扫描位。')
          return
        }
        if (context.writeIndex === null) {
          fail(context, node.id, '装载标记还没有放入仓库。')
          return
        }
        if (context.writeIndex < 0 || context.writeIndex >= context.values.length) {
          fail(context, node.id, '装载标记已经越过仓库边界。')
          return
        }
        const scanIndex = context.scanIndex
        const writeIndex = context.writeIndex
        ;[context.values[scanIndex], context.values[writeIndex]] = [
          context.values[writeIndex],
          context.values[scanIndex],
        ]
        emit(
          context,
          node.id,
          scanIndex === writeIndex
            ? `两个标记都在 ${scanIndex} 号位，货箱保持原位。`
            : `${scanIndex} 号位与 ${writeIndex} 号位完成交换。`,
          [scanIndex, writeIndex],
        )
        break
      }

      case 'advance-write': {
        if (context.writeIndex === null) {
          fail(context, node.id, '装载标记还没有放入仓库。')
          return
        }
        if (context.writeIndex >= context.values.length) {
          fail(context, node.id, '装载标记已经越过仓库边界。')
          return
        }
        context.writeIndex += 1
        emit(
          context,
          node.id,
          context.writeIndex === context.values.length
            ? '装载标记已到达仓库末端。'
            : `装载标记前进到 ${context.writeIndex} 号货位。`,
        )
        break
      }
    }
  }
}

export const interpretProgram = (
  program: BlockNode[],
  input: number[],
): InterpretationResult => {
  const context: RuntimeContext = {
    values: [...input],
    originalValues: [...input],
    scanIndex: null,
    writeIndex: null,
    frames: [],
    halted: false,
  }

  emit(context, null, '机器人已读取规则，等待执行。', [], 'idle')

  if (program.length === 0) {
    fail(context, null, '规则区是空的，机器人没有可执行的动作。')
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
