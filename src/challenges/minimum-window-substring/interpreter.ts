import { findMinimumWindow, type MinimumWindowInput } from './cases'
import { validateMinimumWindowProgram } from './contracts'
import type {
  MinimumWindowInterpretationResult,
  MinimumWindowSkillNode,
  MinimumWindowTraceFrame,
} from './model'

const MAX_FRAMES = 760

interface MinimumWindowRuntime extends MinimumWindowInput {
  need: number[]
  trackedCodes: Set<number>
  targetIndex: number
  left: number
  right: number
  incomingCode: number | null
  outgoingCode: number | null
  missing: number
  bestStart: number | null
  bestLength: number
  initialized: boolean
  targetCharacterRead: boolean
  targetDebtAdded: boolean
  targetRegistered: boolean
  incomingRead: boolean
  incomingChecked: boolean
  incomingDebited: boolean
  insideIncomingCheck: boolean
  insideShrink: boolean
  shorterChecked: boolean
  insideShorterCheck: boolean
  outgoingRead: boolean
  outgoingCredited: boolean
  outgoingChecked: boolean
  insideOutgoingCheck: boolean
  leftAdvanced: boolean
  shrinkVisited: boolean
  rightAdvanced: boolean
  changedCode: number | null
  frames: MinimumWindowTraceFrame[]
  halted: boolean
  error?: string
}

const character = (code: number | null) => code === null ? '' : String.fromCharCode(code)

const needEntries = (runtime: MinimumWindowRuntime) => [...runtime.trackedCodes]
  .sort((left, right) => left - right)
  .map((code) => ({ code, character: character(code), balance: runtime.need[code] ?? 0 }))

const currentResult = (runtime: MinimumWindowRuntime) => (
  runtime.bestStart === null || runtime.bestLength > runtime.source.length
    ? ''
    : runtime.source.slice(runtime.bestStart, runtime.bestStart + runtime.bestLength)
)

const emit = (
  runtime: MinimumWindowRuntime,
  activeNodeId: string | null,
  message: string,
  status: MinimumWindowTraceFrame['status'] = 'running',
) => {
  if (runtime.frames.length >= MAX_FRAMES) {
    runtime.halted = true
    runtime.error = '执行帧超过限制，请检查三个循环是否都会让对应边界前进。'
    return
  }
  runtime.frames.push({
    id: runtime.frames.length,
    source: runtime.source,
    target: runtime.target,
    targetIndex: runtime.targetIndex,
    left: runtime.left,
    right: runtime.right,
    incomingCode: runtime.incomingCode,
    outgoingCode: runtime.outgoingCode,
    missing: runtime.missing,
    bestStart: runtime.bestStart,
    bestLength: runtime.bestStart === null ? null : runtime.bestLength,
    needEntries: needEntries(runtime),
    changedCode: runtime.changedCode,
    activeNodeId,
    message,
    status,
  })
  runtime.changedCode = null
}

const fail = (runtime: MinimumWindowRuntime, activeNodeId: string | null, message: string) => {
  if (runtime.halted) return
  runtime.halted = true
  runtime.error = message
  emit(runtime, activeNodeId, message, 'error')
}

const resetSourceIteration = (runtime: MinimumWindowRuntime) => {
  runtime.incomingCode = null
  runtime.outgoingCode = null
  runtime.incomingRead = false
  runtime.incomingChecked = false
  runtime.incomingDebited = false
  runtime.insideIncomingCheck = false
  runtime.insideShrink = false
  runtime.shorterChecked = false
  runtime.insideShorterCheck = false
  runtime.outgoingRead = false
  runtime.outgoingCredited = false
  runtime.outgoingChecked = false
  runtime.insideOutgoingCheck = false
  runtime.leftAdvanced = false
  runtime.shrinkVisited = false
  runtime.rightAdvanced = false
}

const resetShrinkIteration = (runtime: MinimumWindowRuntime) => {
  runtime.outgoingCode = null
  runtime.shorterChecked = false
  runtime.insideShorterCheck = false
  runtime.outgoingRead = false
  runtime.outgoingCredited = false
  runtime.outgoingChecked = false
  runtime.insideOutgoingCheck = false
  runtime.leftAdvanced = false
}

const executeNodes = (nodes: MinimumWindowSkillNode[], runtime: MinimumWindowRuntime) => {
  for (const node of nodes) {
    if (runtime.halted) return
    switch (node.type) {
      case 'initialize-window': {
        runtime.need.fill(0)
        runtime.trackedCodes.clear()
        runtime.targetIndex = 0
        runtime.left = 0
        runtime.right = 0
        runtime.incomingCode = null
        runtime.outgoingCode = null
        runtime.missing = runtime.target.length
        runtime.bestStart = null
        runtime.bestLength = runtime.source.length + 1
        runtime.initialized = true
        runtime.targetRegistered = false
        emit(
          runtime,
          node.id,
          `欠账表清空；左、右、目标索引都从 0 开始；总欠账设为目标长度 ${runtime.target.length}。`,
        )
        while (runtime.targetIndex < runtime.target.length && !runtime.halted) {
          const index = runtime.targetIndex
          runtime.incomingCode = runtime.target.charCodeAt(index)
          runtime.trackedCodes.add(runtime.incomingCode)
          runtime.changedCode = runtime.incomingCode
          emit(runtime, node.id, `读取目标字符“${character(runtime.incomingCode)}”。`)
          const previousDebt = runtime.need[runtime.incomingCode] ?? 0
          runtime.need[runtime.incomingCode] = previousDebt + 1
          runtime.changedCode = runtime.incomingCode
          emit(runtime, node.id, `字符“${character(runtime.incomingCode)}”的欠账 ${previousDebt} -> ${previousDebt + 1}。`)
          runtime.targetIndex += 1
          runtime.incomingCode = null
          emit(runtime, node.id, `需求卡从 ${index} 号格前进到 ${runtime.targetIndex} 号格。`)
        }
        runtime.targetRegistered = true
        emit(runtime, node.id, '需求卡全部登记完成，字符欠账表已就绪。')
        break
      }

      case 'scan-source': {
        if (!runtime.targetRegistered) {
          fail(runtime, node.id, '扫描文字带前，需要完整登记目标欠账。')
          return
        }
        while (runtime.right < runtime.source.length && !runtime.halted) {
          const startRight = runtime.right
          resetSourceIteration(runtime)
          emit(runtime, node.id, `右标尺停在 ${startRight} 号字符，开始新一轮扩张。`)
          executeNodes(node.children, runtime)
          if (runtime.halted) return
          if (!runtime.shrinkVisited) {
            fail(runtime, node.id, '纳入字符后，需要判断窗口是否已经覆盖目标。')
            return
          }
          runtime.right = startRight + 1
          runtime.rightAdvanced = true
          emit(runtime, node.id, `本轮完成，右标尺从 ${startRight} 号位置前进到 ${runtime.right} 号位置。`)
        }
        emit(runtime, node.id, '右标尺已经到达文字带末尾，全部窗口校准完成。')
        break
      }

      case 'read-incoming-character': {
        if (runtime.right >= runtime.source.length) {
          fail(runtime, node.id, '当前没有可读取的入窗字符。')
          return
        }
        runtime.incomingCode = runtime.source.charCodeAt(runtime.right)
        runtime.trackedCodes.add(runtime.incomingCode)
        runtime.incomingRead = true
        runtime.changedCode = runtime.incomingCode
        emit(runtime, node.id, `读取 ${runtime.right} 号入窗字符“${character(runtime.incomingCode)}”。`)
        const owed = (runtime.need[runtime.incomingCode] ?? 0) > 0
        runtime.incomingChecked = true
        emit(
          runtime,
          node.id,
          owed
            ? `“${character(runtime.incomingCode)}”仍有正欠账，需要补齐一项。`
            : `“${character(runtime.incomingCode)}”没有正欠账，本次属于额外字符。`,
        )
        if (owed) {
          const previousMissing = runtime.missing
          runtime.missing -= 1
          emit(runtime, node.id, `总欠账 ${previousMissing} -> ${runtime.missing}。`)
        }
        const previous = runtime.need[runtime.incomingCode] ?? 0
        runtime.need[runtime.incomingCode] = previous - 1
        runtime.incomingDebited = true
        runtime.changedCode = runtime.incomingCode
        emit(
          runtime,
          node.id,
          `“${character(runtime.incomingCode)}”进入窗口，字符余额 ${previous} -> ${previous - 1}。`,
        )
        break
      }

      case 'shrink-covered-window': {
        if (!runtime.incomingDebited) {
          fail(runtime, node.id, '入窗字符尚未完成记账，不能开始判断覆盖。')
          return
        }
        runtime.shrinkVisited = true
        while (runtime.missing === 0 && !runtime.halted) {
          const startLeft = runtime.left
          resetShrinkIteration(runtime)
          runtime.insideShrink = true
          emit(runtime, node.id, `总欠账为 0，窗口 [${runtime.left}, ${runtime.right}] 已覆盖目标，开始尝试收缩。`)
          executeNodes(node.children, runtime)
          runtime.insideShrink = false
          if (runtime.halted) return
          if (!runtime.leftAdvanced || runtime.left !== startLeft + 1) {
            fail(runtime, node.id, '覆盖窗口每轮收缩都必须先完成出窗记账，再让左标尺前进一步。')
            return
          }
        }
        emit(
          runtime,
          node.id,
          runtime.missing === 0
            ? '当前窗口仍完整覆盖目标。'
            : `总欠账恢复为 ${runtime.missing}，本轮收缩停止。`,
        )
        break
      }

      case 'save-best-window': {
        if (!runtime.insideShrink) {
          fail(runtime, node.id, '只有完整覆盖目标的窗口，才能参与最短记录比较。')
          return
        }
        const width = runtime.right - runtime.left + 1
        const shorter = width < runtime.bestLength
        runtime.shorterChecked = true
        emit(
          runtime,
          node.id,
          `${runtime.right} - ${runtime.left} + 1 = ${width}；${shorter ? '短于' : '不短于'}历史记录 ${runtime.bestLength}。`,
        )
        if (shorter) {
          const previous = runtime.bestStart === null ? '无' : `${runtime.bestStart}:${runtime.bestLength}`
          runtime.bestStart = runtime.left
          runtime.bestLength = width
          emit(runtime, node.id, `历史最短 ${previous} -> 起点 ${runtime.bestStart}、长度 ${runtime.bestLength}，封存“${currentResult(runtime)}”。`)
        }
        break
      }

      case 'read-outgoing-character': {
        if (!runtime.insideShrink || !runtime.shorterChecked || runtime.left >= runtime.source.length) {
          fail(runtime, node.id, '记录检查完成后，才能读取左侧出窗字符。')
          return
        }
        runtime.outgoingCode = runtime.source.charCodeAt(runtime.left)
        runtime.trackedCodes.add(runtime.outgoingCode)
        runtime.outgoingRead = true
        runtime.changedCode = runtime.outgoingCode
        emit(runtime, node.id, `读取 ${runtime.left} 号出窗字符“${character(runtime.outgoingCode)}”。`)
        const previous = runtime.need[runtime.outgoingCode] ?? 0
        runtime.need[runtime.outgoingCode] = previous + 1
        runtime.outgoingCredited = true
        runtime.changedCode = runtime.outgoingCode
        emit(
          runtime,
          node.id,
          `“${character(runtime.outgoingCode)}”离开窗口，字符余额 ${previous} -> ${previous + 1}。`,
        )
        const restored = (runtime.need[runtime.outgoingCode] ?? 0) > 0
        runtime.outgoingChecked = true
        emit(
          runtime,
          node.id,
          restored
            ? `“${character(runtime.outgoingCode)}”余额重新为正，窗口失去一项必要字符。`
            : `“${character(runtime.outgoingCode)}”仍有余量，窗口继续完整覆盖目标。`,
        )
        if (restored) {
          const previousMissing = runtime.missing
          runtime.missing += 1
          emit(runtime, node.id, `总欠账 ${previousMissing} -> ${runtime.missing}。`)
        }
        const previousLeft = runtime.left
        runtime.left += 1
        runtime.leftAdvanced = true
        emit(runtime, node.id, `左标尺从 ${previousLeft} 号位置前进到 ${runtime.left} 号位置。`)
        break
      }
    }
  }
}

export const interpretMinimumWindowProgram = (
  program: MinimumWindowSkillNode[],
  input: MinimumWindowInput,
): MinimumWindowInterpretationResult => {
  const runtime: MinimumWindowRuntime = {
    source: input.source,
    target: input.target,
    need: Array<number>(128).fill(0),
    trackedCodes: new Set(),
    targetIndex: 0,
    left: 0,
    right: 0,
    incomingCode: null,
    outgoingCode: null,
    missing: input.target.length,
    bestStart: null,
    bestLength: input.source.length + 1,
    initialized: false,
    targetCharacterRead: false,
    targetDebtAdded: false,
    targetRegistered: false,
    incomingRead: false,
    incomingChecked: false,
    incomingDebited: false,
    insideIncomingCheck: false,
    insideShrink: false,
    shorterChecked: false,
    insideShorterCheck: false,
    outgoingRead: false,
    outgoingCredited: false,
    outgoingChecked: false,
    insideOutgoingCheck: false,
    leftAdvanced: false,
    shrinkVisited: false,
    rightAdvanced: false,
    changedCode: null,
    frames: [],
    halted: false,
  }

  emit(runtime, null, '窗口校准台等待一套可执行的滑动窗口规则。', 'idle')
  const contract = validateMinimumWindowProgram(program)
  if (!contract.valid) {
    fail(runtime, contract.issues[0]?.nodeId ?? null, contract.issues[0]?.message ?? '规则还不能执行。')
  } else if (input.target.length === 0) {
    fail(runtime, null, '本关目标字符串至少包含一个字符。')
  } else if ([...input.source, ...input.target].some((value) => value.charCodeAt(0) >= 128)) {
    fail(runtime, null, '本关计数台支持 ASCII 字符，请使用英文字母、数字或常用英文符号。')
  } else {
    executeNodes(program, runtime)
  }

  const result = currentResult(runtime)
  if (!runtime.halted) {
    const expected = findMinimumWindow(input)
    if (runtime.right === runtime.source.length && result === expected) {
      emit(
        runtime,
        null,
        result
          ? `校准完成，历史最短封条锁定“${result}”。`
          : '校准完成，没有任何连续窗口能覆盖目标。',
        'success',
      )
    } else {
      fail(runtime, null, `当前规则得到“${result}”，真实最小覆盖窗口应为“${expected}”。`)
    }
  }

  return {
    frames: runtime.frames,
    result,
    bestStart: runtime.bestStart,
    bestLength: runtime.bestStart === null ? null : runtime.bestLength,
    success: !runtime.halted,
    error: runtime.error,
  }
}
