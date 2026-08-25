import type { SemanticResult } from '../types'
import type {
  JavaExpression,
  JavaLValue,
  JavaProgram,
  JavaStatement,
} from '../../codePractice/javaSubset'

export const RAIN_WATER_SEMANTIC_CHECKS = [
  'deploy',
  'patrol',
  'compare',
  'leftAdvance',
  'leftUpdateMax',
  'leftCollect',
  'alternate',
  'rightAdvance',
  'rightUpdateMax',
  'rightCollect',
  'scopes',
  'return',
] as const

const isNumber = (expression: JavaExpression | null, value: number) =>
  expression?.type === 'number' && expression.value === value

const variableName = (expression: JavaExpression | JavaLValue | null) =>
  expression?.type === 'variable' ? expression.name : null

const isHeightLength = (expression: JavaExpression) =>
  expression.type === 'length'
  && expression.array.type === 'variable'
  && expression.array.name === 'height'

const isRightStart = (expression: JavaExpression | null) =>
  expression?.type === 'binary'
  && expression.operator === '-'
  && isHeightLength(expression.left)
  && isNumber(expression.right, 1)

const isHeightAt = (expression: JavaExpression, pointer: string) =>
  expression.type === 'array-access'
  && expression.array.type === 'variable'
  && expression.array.name === 'height'
  && variableName(expression.index) === pointer

const containsHeightAt = (expression: JavaExpression | null, pointer: string): boolean => {
  if (!expression) return false
  if (isHeightAt(expression, pointer)) return true
  switch (expression.type) {
    case 'array-access':
      return containsHeightAt(expression.array, pointer) || containsHeightAt(expression.index, pointer)
    case 'length':
      return containsHeightAt(expression.array, pointer)
    case 'call':
      return expression.args.some((argument) => containsHeightAt(argument, pointer))
    case 'unary':
      return containsHeightAt(expression.operand, pointer)
    case 'binary':
      return containsHeightAt(expression.left, pointer) || containsHeightAt(expression.right, pointer)
    case 'conditional':
      return containsHeightAt(expression.condition, pointer)
        || containsHeightAt(expression.consequent, pointer)
        || containsHeightAt(expression.alternate, pointer)
    default:
      return false
  }
}

const statementsOf = (statement: JavaStatement | null) =>
  statement?.type === 'block' ? statement.statements : statement ? [statement] : []

const declaration = (statements: JavaStatement[], name: string) =>
  statements.find(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
      statement.type === 'declaration' && statement.name === name,
  )

const topLevelDeclarationNames = (statements: JavaStatement[], predicate: (value: JavaExpression | null) => boolean) =>
  statements
    .filter((statement): statement is Extract<JavaStatement, { type: 'declaration' }> => (
      statement.type === 'declaration' && predicate(statement.init)
    ))
    .map((statement) => statement.name)

const isPointerBoundary = (expression: JavaExpression, left: string, right: string) =>
  expression.type === 'binary'
  && (
    (expression.operator === '<'
      && variableName(expression.left) === left
      && variableName(expression.right) === right)
    || (expression.operator === '>'
      && variableName(expression.left) === right
      && variableName(expression.right) === left)
  )

type Side = 'left' | 'right'

const comparisonSides = (
  expression: JavaExpression,
  leftMax: string,
  rightMax: string,
): { consequent: Side; alternate: Side } | null => {
  if (expression.type !== 'binary') return null
  const leftName = variableName(expression.left)
  const rightName = variableName(expression.right)
  if (
    leftName === leftMax
    && rightName === rightMax
    && (expression.operator === '<=' || expression.operator === '<')
  ) return { consequent: 'left', alternate: 'right' }
  if (
    leftName === rightMax
    && rightName === leftMax
    && (expression.operator === '<' || expression.operator === '<=')
  ) return { consequent: 'right', alternate: 'left' }
  if (
    leftName === leftMax
    && rightName === rightMax
    && (expression.operator === '>' || expression.operator === '>=')
  ) return { consequent: 'right', alternate: 'left' }
  if (
    leftName === rightMax
    && rightName === leftMax
    && (expression.operator === '>' || expression.operator === '>=')
  ) return { consequent: 'left', alternate: 'right' }
  return null
}

const incrementMatches = (statement: JavaStatement, pointer: string, delta: 1 | -1) => {
  if (
    statement.type === 'increment'
    && variableName(statement.target) === pointer
    && statement.delta === delta
  ) return true
  if (
    statement.type === 'assignment'
    && variableName(statement.target) === pointer
    && isNumber(statement.value, 1)
  ) {
    return (delta === 1 && statement.operator === '+=')
      || (delta === -1 && statement.operator === '-=')
  }
  return false
}

const maxUpdateMatches = (
  statement: JavaStatement,
  maxName: string,
  pointer: string,
) => {
  if (
    statement.type !== 'assignment'
    || statement.operator !== '='
    || variableName(statement.target) !== maxName
    || statement.value.type !== 'call'
    || statement.value.callee !== 'Math.max'
    || statement.value.args.length !== 2
  ) return false
  const hasOldMax = statement.value.args.some((argument) => variableName(argument) === maxName)
  const hasCurrentHeight = statement.value.args.some((argument) => isHeightAt(argument, pointer))
  return hasOldMax && hasCurrentHeight
}

const collectionMatches = (
  statement: JavaStatement,
  totalName: string,
  maxName: string,
  pointer: string,
) => statement.type === 'assignment'
  && statement.operator === '+='
  && variableName(statement.target) === totalName
  && statement.value.type === 'binary'
  && statement.value.operator === '-'
  && variableName(statement.value.left) === maxName
  && isHeightAt(statement.value.right, pointer)

const analyzeBranch = (
  statement: JavaStatement,
  pointer: string,
  maxName: string,
  totalName: string,
  delta: 1 | -1,
) => {
  const statements = statementsOf(statement)
  const advanceIndex = statements.findIndex((candidate) => incrementMatches(candidate, pointer, delta))
  const maxIndex = statements.findIndex((candidate) => maxUpdateMatches(candidate, maxName, pointer))
  const collectIndex = statements.findIndex((candidate) => (
    collectionMatches(candidate, totalName, maxName, pointer)
  ))
  return {
    advance: advanceIndex >= 0,
    updateMax: advanceIndex >= 0 && maxIndex > advanceIndex,
    collect: maxIndex >= 0 && collectIndex > maxIndex,
  }
}

const firstIssue = (
  checks: Record<string, boolean>,
): SemanticResult['issue'] => {
  const issues: Record<string, string> = {
    deploy: '先完整建立左右位置、两侧岸线和积水总量。',
    patrol: 'while 需要在左右位置相遇前继续巡检。',
    compare: '每轮需要比较两侧已知最高岸线。',
    leftAdvance: '左岸被选中后，黄方需要先向内一步。',
    leftUpdateMax: '黄方移动后，需要比较当前柱高并更新左岸最高柱。',
    leftCollect: '左岸最高柱更新后，需要用它减去当前柱高并累加水深。',
    alternate: '需要用 else 保证每轮只处理一侧岸线。',
    rightAdvance: '右岸被选中后，红方需要先向内一步。',
    rightUpdateMax: '红方移动后，需要比较当前柱高并更新右岸最高柱。',
    rightCollect: '右岸最高柱更新后，需要用它减去当前柱高并累加水深。',
    scopes: '岸线分支需要完整放在 while 巡检作用域内。',
    return: '巡检结束后需要返回同一个积水累加器。',
  }
  const check = RAIN_WATER_SEMANTIC_CHECKS.find((name) => !checks[name])
  return check ? { check, message: issues[check] } : undefined
}

export const analyzeRainWaterProgram = (program: JavaProgram): SemanticResult => {
  const checks = Object.fromEntries(
    RAIN_WATER_SEMANTIC_CHECKS.map((check) => [check, false]),
  ) as Record<string, boolean>

  const loopIndex = program.statements.findIndex((statement) => statement.type === 'while')
  const loop = loopIndex >= 0
    ? program.statements[loopIndex] as Extract<JavaStatement, { type: 'while' }>
    : null
  const beforeLoop = loopIndex >= 0 ? program.statements.slice(0, loopIndex) : program.statements
  const afterLoop = loopIndex >= 0 ? program.statements.slice(loopIndex + 1) : []

  const leftCandidates = topLevelDeclarationNames(beforeLoop, (value) => isNumber(value, 0))
  const rightCandidates = topLevelDeclarationNames(beforeLoop, isRightStart)

  let roles: {
    left: string
    right: string
    leftMax: string
    rightMax: string
    total: string
  } | null = null

  for (const left of leftCandidates) {
    for (const right of rightCandidates) {
      const leftMax = beforeLoop.find(
        (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
          statement.type === 'declaration'
          && statement.name !== left
          && containsHeightAt(statement.init, left),
      )?.name
      const rightMax = beforeLoop.find(
        (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
          statement.type === 'declaration'
          && statement.name !== right
          && statement.name !== leftMax
          && containsHeightAt(statement.init, right),
      )?.name
      const returnedName = afterLoop.find(
        (statement): statement is Extract<JavaStatement, { type: 'return' }> => statement.type === 'return',
      )?.value
      const total = variableName(returnedName ?? null)
      if (
        leftMax
        && rightMax
        && total
        && total !== left
        && total !== right
        && total !== leftMax
        && total !== rightMax
        && isNumber(declaration(beforeLoop, total)?.init ?? null, 0)
      ) {
        roles = { left, right, leftMax, rightMax, total }
        break
      }
    }
    if (roles) break
  }

  checks.deploy = Boolean(roles)
  checks.patrol = Boolean(loop && roles && isPointerBoundary(loop.condition, roles.left, roles.right))

  const loopStatements = statementsOf(loop?.body ?? null)
  const decision = loopStatements.find(
    (statement): statement is Extract<JavaStatement, { type: 'if' }> => statement.type === 'if',
  )
  checks.scopes = Boolean(loop && decision)
  checks.alternate = Boolean(decision?.alternate)

  if (roles && decision) {
    const sides = comparisonSides(decision.condition, roles.leftMax, roles.rightMax)
    checks.compare = Boolean(sides)
    if (sides && decision.alternate) {
      const leftBranch = sides.consequent === 'left' ? decision.consequent : decision.alternate
      const rightBranch = sides.consequent === 'right' ? decision.consequent : decision.alternate
      const leftResult = analyzeBranch(leftBranch, roles.left, roles.leftMax, roles.total, 1)
      const rightResult = analyzeBranch(rightBranch, roles.right, roles.rightMax, roles.total, -1)
      checks.leftAdvance = leftResult.advance
      checks.leftUpdateMax = leftResult.updateMax
      checks.leftCollect = leftResult.collect
      checks.rightAdvance = rightResult.advance
      checks.rightUpdateMax = rightResult.updateMax
      checks.rightCollect = rightResult.collect
    }
    checks.return = afterLoop.some(
      (statement) => statement.type === 'return' && variableName(statement.value) === roles?.total,
    )
  }

  const issue = firstIssue(checks)
  return { valid: !issue, checks, issue }
}
