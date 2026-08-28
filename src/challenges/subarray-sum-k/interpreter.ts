import { countTargetSubarrays } from './cases'
import { validateArchiveProgram } from './contracts'
import type { ArchiveSkillNode } from './model'

export type ArchiveFrameStatus = 'idle' | 'running' | 'success' | 'error'

export interface ArchiveFrequencyEntry {
  sum: number
  count: number
}

export interface ArchiveTraceFrame {
  id: number
  values: number[]
  target: number
  currentIndex: number | null
  currentValue: number | null
  prefix: number
  needed: number | null
  answer: number
  matchedCount: number
  frequencyEntries: ArchiveFrequencyEntry[]
  changedKey: number | null
  activeNodeId: string | null
  message: string
  status: ArchiveFrameStatus
}

export interface ArchiveInterpretationResult {
  frames: ArchiveTraceFrame[]
  answer: number
  success: boolean
  error?: string
}

interface RuntimeContext {
  values: number[]
  target: number
  currentIndex: number | null
  prefix: number
  needed: number | null
  answer: number
  matchedCount: number
  frequency: Map<number, number>
  frames: ArchiveTraceFrame[]
  halted: boolean
  error?: string
}

const MAX_FRAMES = 320

const entriesOf = (frequency: Map<number, number>): ArchiveFrequencyEntry[] =>
  [...frequency.entries()]
    .sort(([left], [right]) => left - right)
    .map(([sum, count]) => ({ sum, count }))

const emit = (
  context: RuntimeContext,
  activeNodeId: string | null,
  message: string,
  changedKey: number | null = null,
  status: ArchiveFrameStatus = 'running',
) => {
  context.frames.push({
    id: context.frames.length,
    values: [...context.values],
    target: context.target,
    currentIndex: context.currentIndex,
    currentValue: context.currentIndex === null || context.currentIndex >= context.values.length
      ? null
      : context.values[context.currentIndex],
    prefix: context.prefix,
    needed: context.needed,
    answer: context.answer,
    matchedCount: context.matchedCount,
    frequencyEntries: entriesOf(context.frequency),
    changedKey,
    activeNodeId,
    message,
    status,
  })
  if (context.frames.length > MAX_FRAMES && !context.halted) {
    fail(context, activeNodeId, '执行帧超过限制，档案站已停止巡查。')
  }
}

const fail = (context: RuntimeContext, activeNodeId: string | null, message: string) => {
  if (context.halted) return
  context.halted = true
  context.error = message
  emit(context, activeNodeId, message, null, 'error')
}

const executeNodes = (nodes: ArchiveSkillNode[], context: RuntimeContext) => {
  for (const node of nodes) {
    if (context.halted) return
    switch (node.type) {
      case 'initialize-archive': {
        context.prefix = 0
        context.needed = null
        context.answer = 0
        context.matchedCount = 0
        context.frequency = new Map([[0, 1]])
        emit(context, node.id, '起点累计刻度 0 已登记 1 次；累计刻度与命中计数都从 0 开始。', 0)
        break
      }
      case 'scan-values': {
        context.currentIndex = 0
        while (context.currentIndex < context.values.length) {
          const index = context.currentIndex
          context.needed = null
          context.matchedCount = 0
          emit(context, node.id, `档案员来到 ${index} 号站，读取当前变化 ${context.values[index]}。`)
          executeNodes(node.children, context)
          if (context.halted) return
          const previous = context.currentIndex
          context.currentIndex += 1
          emit(
            context,
            node.id,
            context.currentIndex >= context.values.length
              ? `本轮处理完成，探针从 ${previous} 号站前进到数值带末端。`
              : `本轮处理完成，探针从 ${previous} 号站前进到 ${context.currentIndex} 号站。`,
          )
        }
        context.currentIndex = null
        emit(context, node.id, '数值带已经巡查完毕。')
        break
      }
      case 'accumulate-prefix': {
        if (context.currentIndex === null) {
          fail(context, node.id, '当前还没有进入任何站点，不能累加刻度。')
          return
        }
        const previous = context.prefix
        const value = context.values[context.currentIndex]
        context.prefix += value
        emit(
          context,
          node.id,
          `累计刻度 ${previous} + 当前变化 ${value} = ${context.prefix}；新值写回累计刻度表。`,
        )
        break
      }
      case 'count-matches': {
        if (context.currentIndex === null) {
          fail(context, node.id, '当前还没有进入站点，无法统计目标区间。')
          return
        }
        context.needed = context.prefix - context.target
        emit(
          context,
          node.id,
          `当前累计刻度 ${context.prefix} - 目标 ${context.target} = 目标旧刻度 ${context.needed}。`,
          context.needed,
        )
        const matches = context.frequency.get(context.needed) ?? 0
        const previous = context.answer
        context.matchedCount = matches
        context.answer += matches
        emit(
          context,
          node.id,
          `旧刻度 ${context.needed} 有 ${matches} 份历史档案；命中计数 ${previous} + ${matches} = ${context.answer}。`,
          context.needed,
        )
        break
      }
      case 'record-prefix': {
        const previous = context.frequency.get(context.prefix) ?? 0
        context.frequency.set(context.prefix, previous + 1)
        emit(
          context,
          node.id,
          `当前刻度 ${context.prefix} 的档案次数 ${previous} -> ${previous + 1}；登记发生在查询之后。`,
          context.prefix,
        )
        break
      }
    }
  }
}

export const interpretArchiveProgram = (
  program: ArchiveSkillNode[],
  values: number[],
  target: number,
): ArchiveInterpretationResult => {
  const context: RuntimeContext = {
    values: [...values],
    target,
    currentIndex: null,
    prefix: 0,
    needed: null,
    answer: 0,
    matchedCount: 0,
    frequency: new Map(),
    frames: [],
    halted: false,
  }
  emit(context, null, '前缀档案站等待执行。', null, 'idle')
  const contract = validateArchiveProgram(program)
  if (!contract.valid) {
    fail(context, contract.issues[0]?.nodeId ?? null, contract.issues[0]?.message ?? '规则还不能执行。')
  } else {
    executeNodes(program, context)
  }
  if (!context.halted) {
    const expected = countTargetSubarrays(values, target)
    if (context.answer === expected) {
      emit(context, null, `巡查完成，共找到 ${context.answer} 个和为 ${target} 的连续子数组。`, null, 'success')
    } else {
      fail(context, null, `档案巡查得到 ${context.answer} 个命中，但真实结果是 ${expected} 个。`)
    }
  }
  return {
    frames: context.frames,
    answer: context.answer,
    success: !context.halted,
    error: context.error,
  }
}
