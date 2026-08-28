import type {
  WindowInterpretationResult,
  WindowSkillNode,
  WindowTraceFrame,
} from './model'

const MAX_FRAMES = 520

interface WindowRuntime {
  source: string
  left: number
  right: number
  windowEnd: number | null
  currentCode: number | null
  frequencies: number[]
  bestLength: number
  bestStart: number | null
  bestEnd: number | null
  changedIndex: number | null
  changedCode: number | null
  initialized: boolean
  admitted: boolean
  bestUpdated: boolean
  frames: WindowTraceFrame[]
  halted: boolean
  error?: string
}

export interface LongestWindowResult {
  length: number
  start: number | null
  end: number | null
}

export const findLongestUniqueWindow = (source: string): LongestWindowResult => {
  const frequencies = Array<number>(128).fill(0)
  let left = 0
  let bestLength = 0
  let bestStart: number | null = null
  let bestEnd: number | null = null

  for (let right = 0; right < source.length; right += 1) {
    const current = source.charCodeAt(right)
    while ((frequencies[current] ?? 0) > 0) {
      frequencies[source.charCodeAt(left)] -= 1
      left += 1
    }
    frequencies[current] = (frequencies[current] ?? 0) + 1
    const length = right - left + 1
    if (length > bestLength) {
      bestLength = length
      bestStart = left
      bestEnd = right
    }
  }

  return { length: bestLength, start: bestStart, end: bestEnd }
}

const visibleFrequencies = (frequencies: number[]) => Object.fromEntries(
  frequencies.flatMap((count, code) => count > 0 ? [[String(code), count]] : []),
)

const emit = (
  runtime: WindowRuntime,
  activeNodeId: string | null,
  message: string,
  status: WindowTraceFrame['status'] = 'running',
) => {
  if (runtime.frames.length >= MAX_FRAMES) {
    runtime.halted = true
    runtime.error = '执行帧超过限制，请检查循环是否会让窗口继续前进。'
    return
  }
  runtime.frames.push({
    id: runtime.frames.length,
    source: runtime.source,
    left: runtime.left,
    right: runtime.right,
    windowEnd: runtime.windowEnd,
    currentCode: runtime.currentCode,
    frequencies: visibleFrequencies(runtime.frequencies),
    bestLength: runtime.bestLength,
    bestStart: runtime.bestStart,
    bestEnd: runtime.bestEnd,
    changedIndex: runtime.changedIndex,
    changedCode: runtime.changedCode,
    activeNodeId,
    message,
    status,
  })
  runtime.changedIndex = null
  runtime.changedCode = null
}

const fail = (runtime: WindowRuntime, activeNodeId: string | null, message: string) => {
  runtime.halted = true
  runtime.error = message
  emit(runtime, activeNodeId, message, 'error')
}

const character = (code: number | null) =>
  code === null ? '' : String.fromCharCode(code)

const executeNodes = (nodes: WindowSkillNode[], runtime: WindowRuntime) => {
  for (const node of nodes) {
    if (runtime.halted) return

    switch (node.type) {
      case 'initialize': {
        if (runtime.initialized) {
          fail(runtime, node.id, '灯廊已经初始化，不能在同一次执行中重复清空状态。')
          return
        }
        runtime.left = 0
        runtime.right = 0
        runtime.windowEnd = null
        runtime.currentCode = null
        runtime.frequencies.fill(0)
        runtime.bestLength = 0
        runtime.bestStart = null
        runtime.bestEnd = null
        runtime.initialized = true
        emit(runtime, node.id, '守窗员与巡灯员回到 0 号站，字符频次和最长记录都从 0 开始。')
        break
      }

      case 'scan': {
        if (!runtime.initialized) {
          fail(runtime, node.id, '巡灯员出发前，需要先让两个角色就位，并初始化频次台和最长记录。')
          return
        }
        while (runtime.right < runtime.source.length && !runtime.halted) {
          const startRight = runtime.right
          runtime.currentCode = null
          runtime.admitted = false
          runtime.bestUpdated = false
          emit(runtime, node.id, `巡灯员停在 ${runtime.right} 号字符，开始新一轮窗口检查。`)
          runtime.currentCode = runtime.source.charCodeAt(runtime.right)
          runtime.changedIndex = runtime.right
          runtime.changedCode = runtime.currentCode
          emit(runtime, node.id, `巡灯员用探照灯读取 ${runtime.right} 号字符“${character(runtime.currentCode)}”。`)
          executeNodes(node.children, runtime)
          if (runtime.halted) return
          if (!runtime.bestUpdated) {
            fail(runtime, node.id, '本轮结束前需要先更新最长记录。')
            return
          }
          runtime.right = startRight + 1
          runtime.currentCode = null
          runtime.admitted = false
          runtime.bestUpdated = false
          emit(runtime, node.id, `本轮完成，巡灯员向右来到 ${runtime.right} 号位置。`)
        }
        emit(runtime, node.id, '巡灯员已经到达字符轨道末尾，全部窗口检查完成。')
        break
      }

      case 'shrink-duplicates': {
        if (runtime.currentCode === null) {
          fail(runtime, node.id, '还没有读取当前字符，无法判断它是否重复。')
          return
        }
        while ((runtime.frequencies[runtime.currentCode] ?? 0) > 0 && !runtime.halted) {
          emit(runtime, node.id, `“${character(runtime.currentCode)}”已在窗口中，守窗员开始清退左端字符。`)
          const code = runtime.source.charCodeAt(runtime.left)
          runtime.frequencies[code] = Math.max(0, (runtime.frequencies[code] ?? 0) - 1)
          runtime.changedIndex = runtime.left
          runtime.changedCode = code
          emit(runtime, node.id, `守窗员移出 ${runtime.left} 号字符“${character(code)}”，它的窗口频次减为 ${runtime.frequencies[code]}。`)
          runtime.left += 1
          emit(runtime, node.id, `守窗员向右来到 ${runtime.left} 号位置，窗口左边界同步收紧。`)
        }
        emit(runtime, node.id, `守窗员确认当前窗口中已经没有重复的“${character(runtime.currentCode)}”。`)
        break
      }

      case 'admit-current': {
        if (runtime.currentCode === null) {
          fail(runtime, node.id, '还没有读取当前字符，无法把它纳入窗口。')
          return
        }
        if ((runtime.frequencies[runtime.currentCode] ?? 0) > 0) {
          fail(runtime, node.id, `“${character(runtime.currentCode)}”仍在窗口中，需要继续从左侧收缩。`)
          return
        }
        if (runtime.admitted) {
          fail(runtime, node.id, '当前字符已经纳入窗口，不能重复登记。')
          return
        }
        runtime.frequencies[runtime.currentCode] = 1
        runtime.windowEnd = runtime.right
        runtime.changedIndex = runtime.right
        runtime.changedCode = runtime.currentCode
        runtime.admitted = true
        emit(runtime, node.id, `“${character(runtime.currentCode)}”进入窗口，当前字符全部保持唯一。`)
        break
      }

      case 'update-best': {
        if (!runtime.admitted) {
          fail(runtime, node.id, '当前字符还没有安全进入窗口，不能计算窗口长度。')
          return
        }
        const width = runtime.right - runtime.left + 1
        const previousBest = runtime.bestLength
        if (width > runtime.bestLength) {
          runtime.bestLength = width
          runtime.bestStart = runtime.left
          runtime.bestEnd = runtime.right
        }
        runtime.bestUpdated = true
        emit(
          runtime,
          node.id,
          width > previousBest
            ? `${runtime.right} - ${runtime.left} + 1 = ${width}，最长记录由 ${previousBest} 更新为 ${width}。`
            : `${runtime.right} - ${runtime.left} + 1 = ${width}，没有超过最长记录 ${previousBest}。`,
        )
        break
      }

    }
  }
}

export const interpretWindowProgram = (
  program: WindowSkillNode[],
  source: string,
): WindowInterpretationResult => {
  const runtime: WindowRuntime = {
    source,
    left: 0,
    right: 0,
    windowEnd: null,
    currentCode: null,
    frequencies: Array<number>(128).fill(0),
    bestLength: 0,
    bestStart: null,
    bestEnd: null,
    changedIndex: null,
    changedCode: null,
    initialized: false,
    admitted: false,
    bestUpdated: false,
    frames: [],
    halted: false,
  }

  emit(runtime, null, '字符灯廊等待一套可执行的窗口规则。', 'idle')
  executeNodes(program, runtime)

  if (!runtime.halted) {
    const expected = findLongestUniqueWindow(source)
    if (runtime.bestLength === expected.length && runtime.right === source.length) {
      emit(
        runtime,
        null,
        `扫描完成，最长无重复窗口长度是 ${runtime.bestLength}。`,
        'success',
      )
    } else {
      fail(
        runtime,
        null,
        runtime.right < source.length
          ? '扫描过早结束，还有字符没有检查。'
          : `当前最长记录是 ${runtime.bestLength}，真实最长长度是 ${expected.length}。`,
      )
    }
  }

  return {
    frames: runtime.frames,
    bestLength: runtime.bestLength,
    bestStart: runtime.bestStart,
    bestEnd: runtime.bestEnd,
    success: !runtime.halted,
    error: runtime.error,
  }
}
