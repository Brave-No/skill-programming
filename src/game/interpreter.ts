import type {
  InterpretationResult,
  ScoutSide,
  SkillNode,
  TraceFrame,
} from './model'

const MAX_FRAMES = 320

interface RuntimeContext {
  terrain: number[]
  water: number[]
  frames: TraceFrame[]
  left: number | null
  right: number | null
  leftMax: number
  rightMax: number
  leftMaxIndex: number | null
  rightMaxIndex: number | null
  selectedSide: ScoutSide | null
  advancedSide: ScoutSide | null
  updatedSide: ScoutSide | null
  halted: boolean
  error?: string
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export const calculateWater = (terrain: number[]) => {
  const water = Array(terrain.length).fill(0)
  if (terrain.length === 0) return water

  let left = 0
  let right = terrain.length - 1
  let leftMax = terrain[left]
  let rightMax = terrain[right]

  while (left < right) {
    if (leftMax <= rightMax) {
      left += 1
      leftMax = Math.max(leftMax, terrain[left])
      water[left] = leftMax - terrain[left]
    } else {
      right -= 1
      rightMax = Math.max(rightMax, terrain[right])
      water[right] = rightMax - terrain[right]
    }
  }

  return water
}

const emit = (
  context: RuntimeContext,
  activeNodeId: string | null,
  message: string,
  changedIndex: number | null = null,
  status: TraceFrame['status'] = 'running',
) => {
  context.frames.push({
    id: context.frames.length,
    terrain: [...context.terrain],
    water: [...context.water],
    left: context.left,
    right: context.right,
    leftMax: context.leftMax,
    rightMax: context.rightMax,
    leftMaxIndex: context.leftMaxIndex,
    rightMaxIndex: context.rightMaxIndex,
    selectedSide: context.selectedSide,
    activeNodeId,
    changedIndex,
    totalWater: sum(context.water),
    message,
    status,
  })

  if (context.frames.length > MAX_FRAMES && !context.halted) {
    fail(context, activeNodeId, '巡检步骤过多，控制台已停止运行。')
  }
}

const fail = (context: RuntimeContext, activeNodeId: string | null, message: string) => {
  if (context.halted) return
  context.halted = true
  context.error = message
  emit(context, activeNodeId, message, null, 'error')
}

const executeNodes = (nodes: SkillNode[], context: RuntimeContext) => {
  for (const node of nodes) {
    if (context.halted) return

    switch (node.type) {
      case 'deploy': {
        context.left = 0
        context.right = context.terrain.length - 1
        context.leftMax = context.terrain[context.left] ?? 0
        context.rightMax = context.terrain[context.right] ?? 0
        context.leftMaxIndex = context.terrain.length > 0 ? context.left : null
        context.rightMaxIndex = context.terrain.length > 0 ? context.right : null
        context.selectedSide = null
        context.advancedSide = null
        context.updatedSide = null
        emit(
          context,
          node.id,
          context.terrain.length > 0
            ? `左右巡线员就位：左岸最高柱是 0 号，高 ${context.leftMax}；右岸最高柱是 ${context.right} 号，高 ${context.rightMax}。`
            : '地形为空，没有需要记录的最高柱。',
        )
        break
      }

      case 'patrol': {
        if (context.left === null || context.right === null) {
          fail(context, node.id, '双端巡线员还没有就位。')
          return
        }

        let rounds = 0
        while (context.left < context.right) {
          const previousLeft: number = context.left
          const previousRight: number = context.right
          emit(context, node.id, `第 ${rounds + 1} 轮巡检开始。`)
          executeNodes(node.children, context)
          if (context.halted) return

          if (context.left === previousLeft && context.right === previousRight) {
            fail(context, node.id, '这一轮结束后两名巡线员都没有移动，巡检停在了原地。')
            return
          }

          rounds += 1
          if (rounds > context.terrain.length + 1) {
            fail(context, node.id, '巡线员没有按预期靠拢，巡检已停止。')
            return
          }
        }

        emit(context, node.id, '两名巡线员已经完成整段地形的巡检。')
        break
      }

      case 'compare': {
        if (context.left === null || context.right === null) {
          fail(context, node.id, '当前没有可比较的左右岸线。')
          return
        }
        if (context.left >= context.right) {
          emit(context, node.id, '两名巡线员已经相遇，不再选择新的岸线。')
          break
        }
        context.selectedSide = context.leftMax <= context.rightMax ? 'left' : 'right'
        context.advancedSide = null
        context.updatedSide = null
        emit(
          context,
          node.id,
          context.selectedSide === 'left'
            ? `左岸最高柱 ${context.leftMax} 不高于右岸最高柱 ${context.rightMax}，本轮处理左侧。`
            : `右岸最高柱 ${context.rightMax} 低于左岸最高柱 ${context.leftMax}，本轮处理右侧。`,
        )
        break
      }

      case 'update-max': {
        if (context.selectedSide === null || context.left === null || context.right === null) {
          fail(context, node.id, '还没有选出本轮需要更新的较低一侧。')
          return
        }
        if (context.advancedSide !== context.selectedSide) {
          fail(context, node.id, '低岸巡线员还没有进入新位置，不能更新最高柱。')
          return
        }
        if (context.updatedSide === context.selectedSide) {
          fail(context, node.id, '本轮已经更新过最高柱，不需要重复更新。')
          return
        }

        const index = context.selectedSide === 'left' ? context.left : context.right
        const height = context.terrain[index]

        if (context.selectedSide === 'left') {
          const previousMax = context.leftMax
          const previousIndex = context.leftMaxIndex
          if (height > context.leftMax) {
            context.leftMax = height
            context.leftMaxIndex = index
          }
          emit(
            context,
            node.id,
            height > previousMax
              ? `${index} 号柱高 ${height}，超过左岸原最高柱 ${previousMax}；左岸最高柱更新到 ${index} 号。`
              : `${index} 号柱高 ${height}，没有超过左岸最高柱 ${previousMax}；仍记住 ${previousIndex} 号柱。`,
            index,
          )
        } else {
          const previousMax = context.rightMax
          const previousIndex = context.rightMaxIndex
          if (height > context.rightMax) {
            context.rightMax = height
            context.rightMaxIndex = index
          }
          emit(
            context,
            node.id,
            height > previousMax
              ? `${index} 号柱高 ${height}，超过右岸原最高柱 ${previousMax}；右岸最高柱更新到 ${index} 号。`
              : `${index} 号柱高 ${height}，没有超过右岸最高柱 ${previousMax}；仍记住 ${previousIndex} 号柱。`,
            index,
          )
        }
        context.updatedSide = context.selectedSide
        break
      }

      case 'collect': {
        if (context.selectedSide === null || context.left === null || context.right === null) {
          fail(context, node.id, '还没有选出本轮需要计算积水的较低一侧。')
          return
        }
        if (context.advancedSide !== context.selectedSide) {
          fail(context, node.id, '低岸巡线员还没有向内移动，当前位置不能计算积水。')
          return
        }
        if (context.updatedSide !== context.selectedSide) {
          fail(context, node.id, '当前柱还没有和本侧最高柱比较并更新，暂时不能计算积水。')
          return
        }

        const index = context.selectedSide === 'left' ? context.left : context.right
        const height = context.terrain[index]
        const maxHeight = context.selectedSide === 'left' ? context.leftMax : context.rightMax
        const sideLabel = context.selectedSide === 'left' ? '左岸' : '右岸'
        const depth = maxHeight - height

        context.water[index] = depth
        emit(
          context,
          node.id,
          `${sideLabel}最高柱 ${maxHeight} - ${index} 号柱高 ${height} = 当前积水 ${depth} 格；累计 ${sum(context.water)} 格。`,
          index,
        )
        context.selectedSide = null
        context.advancedSide = null
        context.updatedSide = null
        break
      }

      case 'advance': {
        if (
          context.selectedSide === null ||
          context.left === null ||
          context.right === null
        ) {
          fail(context, node.id, '还没有选出本轮需要移动的较低岸线。')
          return
        }
        if (context.advancedSide === context.selectedSide) {
          fail(context, node.id, '本轮低岸巡线员已经向内移动过一次。')
          return
        }

        if (context.selectedSide === 'left') {
          context.left += 1
          emit(context, node.id, `左侧巡线员向内来到 ${context.left} 号位置。`)
        } else {
          context.right -= 1
          emit(context, node.id, `右侧巡线员向内来到 ${context.right} 号位置。`)
        }
        context.advancedSide = context.selectedSide
        context.updatedSide = null
        break
      }
    }
  }
}

const equalValues = (left: number[], right: number[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

export const interpretProgram = (
  program: SkillNode[],
  terrain: number[],
): InterpretationResult => {
  const context: RuntimeContext = {
    terrain: [...terrain],
    water: Array(terrain.length).fill(0),
    frames: [],
    left: null,
    right: null,
    leftMax: 0,
    rightMax: 0,
    leftMaxIndex: null,
    rightMaxIndex: null,
    selectedSide: null,
    advancedSide: null,
    updatedSide: null,
    halted: false,
  }

  emit(context, null, '雨线巡检台等待执行。', null, 'idle')
  executeNodes(program, context)

  if (!context.halted) {
    const expected = calculateWater(terrain)
    if (equalValues(context.water, expected)) {
      emit(
        context,
        null,
        `整段地形共记录 ${sum(context.water)} 格雨水。`,
        null,
        'success',
      )
    } else {
      fail(
        context,
        null,
        sum(context.water) === sum(expected)
          ? '总量相同，但部分位置的水深记录不正确。'
          : '巡检已经结束，但仍有积水位置没有被正确记录。',
      )
    }
  }

  return {
    frames: context.frames,
    water: [...context.water],
    totalWater: sum(context.water),
    success: !context.halted,
    error: context.error,
  }
}
