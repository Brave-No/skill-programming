import type { SemanticResult } from '../types'
import type {
  JavaExpression,
  JavaLValue,
  JavaProgram,
  JavaStatement,
} from '../../codePractice/javaSubset'

export const LONGEST_SUBSTRING_SEMANTIC_CHECKS = [
  'initialize',
  'scan',
  'readCurrent',
  'duplicate',
  'release',
  'moveLeft',
  'admit',
  'updateBest',
  'moveRight',
  'scopes',
  'return',
] as const

const isNumber = (expression: JavaExpression | null, value: number) =>
  expression?.type === 'number' && expression.value === value

const variableName = (expression: JavaExpression | JavaLValue | null) =>
  expression?.type === 'variable' ? expression.name : null

const statementsOf = (statement: JavaStatement | null) =>
  statement?.type === 'block' ? statement.statements : statement ? [statement] : []

const declaration = (statements: JavaStatement[], name: string) =>
  statements.find(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
      statement.type === 'declaration' && statement.name === name,
  )

const isStringLength = (expression: JavaExpression, stringName = 's') =>
  expression.type === 'call'
  && expression.callee === `${stringName}.length`
  && expression.args.length === 0

const isCharAt = (
  expression: JavaExpression | null,
  indexName: string,
  stringName = 's',
) => expression?.type === 'call'
  && expression.callee === `${stringName}.charAt`
  && expression.args.length === 1
  && variableName(expression.args[0]) === indexName

const isNewFrequencyArray = (expression: JavaExpression | null) => {
  if (!expression) return false
  const candidate = expression as unknown as {
    type?: string
    elementType?: string
    length?: JavaExpression
  }
  return candidate.type === 'new-array'
    && candidate.elementType === 'int'
    && candidate.length?.type === 'number'
    && candidate.length.value >= 128
}

const scanPointer = (condition: JavaExpression) => {
  if (condition.type !== 'binary') return null
  if (
    (condition.operator === '<' || condition.operator === '<=')
    && condition.left.type === 'variable'
    && isStringLength(condition.right)
  ) return condition.left.name
  if (
    (condition.operator === '>' || condition.operator === '>=')
    && isStringLength(condition.left)
    && condition.right.type === 'variable'
  ) return condition.right.name
  return null
}

const arrayAccess = (
  expression: JavaExpression,
  arrayName: string,
  indexName: string,
) => expression.type === 'array-access'
  && variableName(expression.array) === arrayName
  && variableName(expression.index) === indexName

const duplicateCondition = (
  expression: JavaExpression,
  countsName: string,
  currentName: string,
) => {
  if (expression.type !== 'binary') return false
  const leftAccess = arrayAccess(expression.left, countsName, currentName)
  const rightAccess = arrayAccess(expression.right, countsName, currentName)
  return (
    leftAccess
    && isNumber(expression.right, 0)
    && ['>', '!='].includes(expression.operator)
  ) || (
    rightAccess
    && isNumber(expression.left, 0)
    && ['<', '!='].includes(expression.operator)
  )
}

const incrementMatches = (
  statement: JavaStatement,
  targetName: string,
  delta: 1 | -1,
) => {
  if (
    statement.type === 'increment'
    && variableName(statement.target) === targetName
    && statement.delta === delta
  ) return true
  return statement.type === 'assignment'
    && variableName(statement.target) === targetName
    && isNumber(statement.value, 1)
    && ((delta === 1 && statement.operator === '+=') || (delta === -1 && statement.operator === '-='))
}

const arrayIncrementMatches = (
  statement: JavaStatement,
  countsName: string,
  indexMatches: (index: JavaExpression) => boolean,
  delta: 1 | -1,
) => {
  const target = statement.type === 'increment' || statement.type === 'assignment'
    ? statement.target
    : null
  if (
    target?.type !== 'array-access'
    || variableName(target.array) !== countsName
    || !indexMatches(target.index)
  ) return false
  if (statement.type === 'increment') return statement.delta === delta
  if (statement.type !== 'assignment') return false
  return isNumber(statement.value, 1)
    && ((delta === 1 && statement.operator === '+=') || (delta === -1 && statement.operator === '-='))
}

const containsWindowWidth = (
  expression: JavaExpression,
  leftName: string,
  rightName: string,
): boolean => {
  if (expression.type !== 'binary') return false

  const rightMinusLeft = (candidate: JavaExpression) => candidate.type === 'binary'
    && candidate.operator === '-'
    && variableName(candidate.left) === rightName
    && variableName(candidate.right) === leftName

  if (expression.operator === '+') {
    return (rightMinusLeft(expression.left) && isNumber(expression.right, 1))
      || (isNumber(expression.left, 1) && rightMinusLeft(expression.right))
      || (
        expression.left.type === 'binary'
        && expression.left.operator === '+'
        && variableName(expression.left.left) === rightName
        && isNumber(expression.left.right, 1)
        && variableName(expression.right) === leftName
      )
  }
  return false
}

const bestUpdateMatches = (
  statement: JavaStatement,
  bestName: string,
  leftName: string,
  rightName: string,
) => {
  if (
    statement.type !== 'assignment'
    || statement.operator !== '='
    || variableName(statement.target) !== bestName
    || statement.value.type !== 'call'
    || statement.value.callee !== 'Math.max'
    || statement.value.args.length !== 2
  ) return false
  const hasBest = statement.value.args.some((argument) => variableName(argument) === bestName)
  const hasWidth = statement.value.args.some((argument) => containsWindowWidth(argument, leftName, rightName))
  return hasBest && hasWidth
}

const firstIssue = (checks: Record<string, boolean>): SemanticResult['issue'] => {
  const messages: Record<string, string> = {
    initialize: '先让守窗员与巡灯员就位，并建立左右边界、最长记录和 128 项字符频次数组。',
    scan: '外层 while 需要让巡灯员在字符串末尾前持续工作。',
    readCurrent: '每轮需要按巡灯员所在位置读取当前字符。',
    duplicate: '发现当前字符仍在窗口中时，需要用 while 持续收缩，而不是只移动一次。',
    release: '收缩窗口时，守窗员先把左边界字符的频次减一。',
    moveLeft: '左端字符移出后，再让守窗员带着左边界向右一步。',
    admit: '重复清除后，需要把当前字符登记到窗口频次台。',
    updateBest: '当前字符纳入后，用 right - left + 1 更新最长记录。',
    moveRight: '最长记录更新后，巡灯员每轮前进一步。',
    scopes: '读取、收缩、纳入、记录和前进需要完整嵌套在扫描循环中。',
    return: '扫描结束后需要返回同一个最长记录变量。',
  }
  const check = LONGEST_SUBSTRING_SEMANTIC_CHECKS.find((name) => !checks[name])
  return check ? { check, message: messages[check] } : undefined
}

export const analyzeLongestSubstringProgram = (program: JavaProgram): SemanticResult => {
  const checks = Object.fromEntries(
    LONGEST_SUBSTRING_SEMANTIC_CHECKS.map((check) => [check, false]),
  ) as Record<string, boolean>

  const loopIndex = program.statements.findIndex(
    (statement) => statement.type === 'while' && scanPointer(statement.condition) !== null,
  )
  const loop = loopIndex >= 0
    ? program.statements[loopIndex] as Extract<JavaStatement, { type: 'while' }>
    : null
  const rightName = loop ? scanPointer(loop.condition) : null
  const beforeLoop = loopIndex >= 0 ? program.statements.slice(0, loopIndex) : program.statements
  const afterLoop = loopIndex >= 0 ? program.statements.slice(loopIndex + 1) : []

  checks.scan = Boolean(loop && rightName)

  if (loop && rightName) {
    const body = statementsOf(loop.body)
    const readIndex = body.findIndex(
      (statement) => statement.type === 'declaration' && isCharAt(statement.init, rightName),
    )
    const read = readIndex >= 0
      ? body[readIndex] as Extract<JavaStatement, { type: 'declaration' }>
      : null
    const currentName = read?.name ?? null
    checks.readCurrent = Boolean(read)

    const countsDeclarations = beforeLoop.filter(
      (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
        statement.type === 'declaration' && isNewFrequencyArray(statement.init),
    )

    for (const countsDeclaration of countsDeclarations) {
      if (!currentName) continue
      const countsName = countsDeclaration.name
      const shrinkIndex = body.findIndex(
        (statement) => statement.type === 'while'
          && duplicateCondition(statement.condition, countsName, currentName),
      )
      if (shrinkIndex < 0) continue
      const shrink = body[shrinkIndex] as Extract<JavaStatement, { type: 'while' }>
      const shrinkBody = statementsOf(shrink.body)
      checks.duplicate = true

      const releaseIndex = shrinkBody.findIndex((statement) => arrayIncrementMatches(
        statement,
        countsName,
        (index) => index.type === 'call'
          && index.callee === 's.charAt'
          && index.args.length === 1
          && index.args[0].type === 'variable',
        -1,
      ))
      const release = releaseIndex >= 0
        ? shrinkBody[releaseIndex]
        : null
      const releaseTarget = release && (release.type === 'increment' || release.type === 'assignment')
        ? release.target
        : null
      const leftName = releaseTarget?.type === 'array-access'
        && releaseTarget.index.type === 'call'
        ? variableName(releaseTarget.index.args[0])
        : null
      checks.release = Boolean(release && leftName)

      const moveLeftIndex = leftName
        ? shrinkBody.findIndex((statement) => incrementMatches(statement, leftName, 1))
        : -1
      checks.moveLeft = releaseIndex >= 0 && moveLeftIndex > releaseIndex

      const admitIndex = body.findIndex((statement, index) => index > shrinkIndex && arrayIncrementMatches(
        statement,
        countsName,
        (expression) => variableName(expression) === currentName,
        1,
      ))
      checks.admit = admitIndex > shrinkIndex

      if (!leftName) continue
      const bestCandidates = beforeLoop.filter(
        (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
          statement.type === 'declaration'
          && statement.name !== rightName
          && statement.name !== leftName
          && isNumber(statement.init, 0),
      )
      const bestDeclaration = bestCandidates.find((candidate) => body.some(
        (statement) => bestUpdateMatches(statement, candidate.name, leftName, rightName),
      ))
      const bestName = bestDeclaration?.name ?? null
      const updateBestIndex = bestName
        ? body.findIndex((statement) => bestUpdateMatches(statement, bestName, leftName, rightName))
        : -1
      checks.updateBest = admitIndex >= 0 && updateBestIndex > admitIndex

      const moveRightIndex = body.findIndex((statement) => incrementMatches(statement, rightName, 1))
      checks.moveRight = updateBestIndex >= 0 && moveRightIndex > updateBestIndex

      const leftDeclaration = declaration(beforeLoop, leftName)
      const rightDeclaration = declaration(beforeLoop, rightName)
      checks.initialize = Boolean(
        leftDeclaration && isNumber(leftDeclaration.init, 0)
        && rightDeclaration && isNumber(rightDeclaration.init, 0)
        && bestDeclaration && isNumber(bestDeclaration.init, 0)
        && countsDeclaration,
      )
      checks.scopes = readIndex >= 0
        && shrinkIndex > readIndex
        && releaseIndex >= 0
        && moveLeftIndex > releaseIndex
        && admitIndex > shrinkIndex
        && updateBestIndex > admitIndex
        && moveRightIndex > updateBestIndex
      checks.return = Boolean(
        bestName
        && afterLoop.some(
          (statement) => statement.type === 'return' && variableName(statement.value) === bestName,
        ),
      )

      if (checks.initialize && checks.scopes && checks.return) break
    }
  }

  const issue = firstIssue(checks)
  return { valid: !issue, checks, issue }
}
