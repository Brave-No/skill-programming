import { findAnagramIndices, type AnagramInput } from './cases'
import {
  validateAnagramSkillProgram,
  type AnagramInterpretationResult,
  type AnagramSkillNode,
  type AnagramTraceFrame,
} from './model'

const MAX_FRAMES = 900

interface RuntimeContext extends AnagramInput {
  targetCounts: number[]
  windowCounts: number[]
  left: number
  right: number | null
  patternIndex: number | null
  activeChar: string | null
  enteringIndex: number | null
  leavingIndex: number | null
  matches: number[]
  frequenciesMatch: boolean
  overflow: boolean
  incomingAdded: boolean
  outgoingRemoved: boolean
  leftAdvanced: boolean
  frames: AnagramTraceFrame[]
  halted: boolean
  error?: string
}

const sameCounts = (left: number[], right: number[]) =>
  left.every((count, index) => count === right[index])

const sameValues = (left: number[], right: number[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

const bucketOf = (character: string) => character.charCodeAt(0) - 97

const emit = (
  context: RuntimeContext,
  activeNodeId: string | null,
  message: string,
  status: AnagramTraceFrame['status'] = 'running',
) => {
  context.frames.push({
    id: context.frames.length,
    source: context.source,
    pattern: context.pattern,
    targetCounts: [...context.targetCounts],
    windowCounts: [...context.windowCounts],
    left: context.left,
    right: context.right,
    patternIndex: context.patternIndex,
    activeChar: context.activeChar,
    enteringIndex: context.enteringIndex,
    leavingIndex: context.leavingIndex,
    matches: [...context.matches],
    frequenciesMatch: context.frequenciesMatch,
    overflow: context.overflow,
    activeNodeId,
    message,
    status,
  })
  if (context.frames.length > MAX_FRAMES && !context.halted) {
    fail(context, activeNodeId, '执行帧超过限制，扫描站已经停止。')
  }
}

const fail = (context: RuntimeContext, nodeId: string | null, message: string) => {
  if (context.halted) return
  context.halted = true
  context.error = message
  emit(context, nodeId, message, 'error')
}

const executeNodes = (nodes: AnagramSkillNode[], context: RuntimeContext) => {
  for (const node of nodes) {
    if (context.halted) return

    switch (node.type) {
      case 'prepare': {
        context.targetCounts.fill(0)
        context.windowCounts.fill(0)
        context.left = 0
        context.right = null
        context.matches = []
        context.frequenciesMatch = false
        emit(context, node.id, '频谱台已归零，左侧夹具停在 0 号位置，命中纸带为空。')
        for (let index = 0; index < context.pattern.length; index += 1) {
          context.patternIndex = index
          context.activeChar = context.pattern[index]
          emit(context, node.id, `目标读头来到 ${index} 号字母“${context.activeChar}”。`)
          const bucket = bucketOf(context.activeChar)
          const before = context.targetCounts[bucket]
          context.targetCounts[bucket] += 1
          emit(
            context,
            node.id,
            `目标字母“${context.activeChar}”落入 ${bucket} 号频谱格：${before} → ${context.targetCounts[bucket]}。`,
          )
        }
        context.patternIndex = null
        context.activeChar = null
        emit(context, node.id, '目标信号已经全部写入目标频谱。')
        break
      }

      case 'scan-source': {
        for (let right = 0; right < context.source.length; right += 1) {
          context.right = right
          context.activeChar = context.source[right]
          context.enteringIndex = right
          context.leavingIndex = null
          context.incomingAdded = false
          context.outgoingRemoved = false
          context.leftAdvanced = false
          context.overflow = false
          context.frequenciesMatch = false
          emit(context, node.id, `右探针来到 ${right} 号字母“${context.activeChar}”。`)
          executeNodes(node.children, context)
          if (context.halted) return
        }
        context.activeChar = null
        context.enteringIndex = null
        context.leavingIndex = null
        emit(context, node.id, '右探针已经扫描完整条源信号。')
        break
      }

      case 'add-incoming': {
        if (context.right === null) {
          fail(context, node.id, '右探针尚未进入源信号。')
          return
        }
        if (context.incomingAdded) {
          fail(context, node.id, '本轮右侧字母已经纳入窗口。')
          return
        }
        const character = context.source[context.right]
        const bucket = bucketOf(character)
        const before = context.windowCounts[bucket]
        context.windowCounts[bucket] += 1
        context.incomingAdded = true
        emit(context, node.id, `进入字母“${character}”使 ${bucket} 号窗口频谱格 ${before} → ${context.windowCounts[bucket]}。`)
        break
      }

      case 'if-overflow': {
        if (context.right === null || !context.incomingAdded) {
          fail(context, node.id, '需要先纳入右侧字母，再判断窗口宽度。')
          return
        }
        const width = context.right - context.left + 1
        context.overflow = width > context.pattern.length
        emit(
          context,
          node.id,
          context.overflow
            ? `窗口宽度 ${width} > 目标长度 ${context.pattern.length}，需要收缩左侧。`
            : `窗口宽度 ${width} 未超过目标长度 ${context.pattern.length}，左侧保持。`,
        )
        if (context.overflow) {
          const character = context.source[context.left]
          const bucket = bucketOf(character)
          const before = context.windowCounts[bucket]
          context.windowCounts[bucket] -= 1
          context.leavingIndex = context.left
          context.activeChar = character
          context.outgoingRemoved = true
          emit(context, node.id, `离开字母“${character}”使 ${bucket} 号窗口频谱格 ${before} → ${context.windowCounts[bucket]}。`)
          const previousLeft = context.left
          context.left += 1
          context.leftAdvanced = true
          context.activeChar = null
          emit(context, node.id, `左侧夹具从 ${previousLeft} 号推进到 ${context.left} 号。`)
        }
        break
      }

      case 'if-match': {
        if (context.right === null || !context.incomingAdded) {
          fail(context, node.id, '需要先完成本轮窗口更新，再比较频谱。')
          return
        }
        if (context.overflow && !context.leftAdvanced) {
          fail(context, node.id, '窗口仍然超宽，不能开始频谱比较。')
          return
        }
        const width = context.right - context.left + 1
        const fixedWidth = width === context.pattern.length
        context.frequenciesMatch = fixedWidth && sameCounts(context.targetCounts, context.windowCounts)
        emit(
          context,
          node.id,
          !fixedWidth
            ? `窗口宽度 ${width}，尚未达到目标长度 ${context.pattern.length}。`
            : context.frequenciesMatch
              ? `窗口 [${context.left}, ${context.right}] 宽度正确，26 格频谱完全一致。`
              : `窗口 [${context.left}, ${context.right}] 宽度正确，但频谱仍有差异。`,
        )
        if (context.frequenciesMatch) {
          context.matches.push(context.left)
          emit(context, node.id, `频谱命中，纸带追加窗口起点 ${context.left}。`)
        }
        break
      }
    }
  }
}

export const interpretAnagramProgram = (
  program: AnagramSkillNode[],
  input: AnagramInput,
): AnagramInterpretationResult => {
  const context: RuntimeContext = {
    ...input,
    targetCounts: Array(26).fill(0),
    windowCounts: Array(26).fill(0),
    left: 0,
    right: null,
    patternIndex: null,
    activeChar: null,
    enteringIndex: null,
    leavingIndex: null,
    matches: [],
    frequenciesMatch: false,
    overflow: false,
    incomingAdded: false,
    outgoingRemoved: false,
    leftAdvanced: false,
    frames: [],
    halted: false,
  }

  emit(context, null, '频谱滑窗站等待执行。', 'idle')
  const validation = validateAnagramSkillProgram(program)
  if (!validation.valid) {
    fail(context, validation.issue?.nodeId ?? null, validation.issue?.message ?? '技能程序尚未连通。')
  } else {
    executeNodes(program, context)
  }

  if (!context.halted) {
    const expected = findAnagramIndices(input)
    if (sameValues(context.matches, expected)) {
      emit(context, null, `扫描完成，共记录 ${context.matches.length} 个异位词窗口。`, 'success')
    } else {
      fail(context, null, '扫描已经结束，但命中纸带与真实异位词窗口不一致。')
    }
  }

  return {
    frames: context.frames,
    matches: [...context.matches],
    success: !context.halted,
    error: context.error,
  }
}
