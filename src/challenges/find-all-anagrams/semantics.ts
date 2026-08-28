import type {
  JavaExpression,
  JavaLValue,
  JavaProgram,
  JavaStatement,
} from '../../codePractice/javaSubset'
import type { SemanticResult } from '../types'

export const ANAGRAM_SEMANTIC_CHECKS = [
  'initialize',
  'patternLoop',
  'targetCount',
  'patternScope',
  'sourceLoop',
  'addIncoming',
  'overflowCondition',
  'removeOutgoing',
  'leftAdvance',
  'matchCondition',
  'recordIndex',
  'scopes',
  'returnResult',
] as const

type JavaFor = Extract<JavaStatement, { type: 'for' }>

const isNumber = (expression: JavaExpression | null, value: number) =>
  expression?.type === 'number' && expression.value === value

const variableName = (expression: JavaExpression | JavaLValue | null) =>
  expression?.type === 'variable' ? expression.name : null

const statementsOf = (statement: JavaStatement | null) =>
  statement?.type === 'block' ? statement.statements : statement ? [statement] : []

const stringLength = (expression: JavaExpression, stringName: string) =>
  expression.type === 'call'
  && expression.callee === `${stringName}.length`
  && expression.args.length === 0

const loopIndexName = (loop: JavaFor, stringName: string) => {
  const init = loop.init
  if (
    init?.type !== 'declaration'
    || init.valueType !== 'int'
    || !isNumber(init.init, 0)
  ) return null
  const name = init.name
  const condition = loop.condition
  const conditionMatches = condition?.type === 'binary' && (
    (condition.operator === '<'
      && variableName(condition.left) === name
      && stringLength(condition.right, stringName))
    || (condition.operator === '>'
      && stringLength(condition.left, stringName)
      && variableName(condition.right) === name)
  )
  const update = loop.update
  const updateMatches = Boolean(
    update?.type === 'increment'
      && variableName(update.target) === name
      && update.delta === 1,
  ) || Boolean(
    update?.type === 'assignment'
      && variableName(update.target) === name
      && update.operator === '+='
      && isNumber(update.value, 1),
  )
  return conditionMatches && updateMatches ? name : null
}

const newIntArrayLength = (expression: JavaExpression | null, length: number) =>
  expression?.type === 'new-array'
  && expression.elementType === 'int'
  && isNumber(expression.length, length)

const isAlphabetIndex = (
  expression: JavaExpression,
  stringName: string,
  indexName: string,
) => expression.type === 'binary'
  && expression.operator === '-'
  && expression.left.type === 'call'
  && expression.left.callee === `${stringName}.charAt`
  && expression.left.args.length === 1
  && variableName(expression.left.args[0]) === indexName
  && isNumber(expression.right, 97)

const arrayDelta = (
  statement: JavaStatement,
  stringName: string,
  indexName: string,
  delta: 1 | -1,
) => {
  const target = statement.type === 'increment' || statement.type === 'assignment'
    ? statement.target
    : null
  if (
    target?.type !== 'array-access'
    || target.array.type !== 'variable'
    || !isAlphabetIndex(target.index, stringName, indexName)
  ) return null
  let matches = false
  if (statement.type === 'increment') {
    matches = statement.delta === delta
  } else if (statement.type === 'assignment') {
    matches = isNumber(statement.value, 1)
      && ((delta === 1 && statement.operator === '+=') || (delta === -1 && statement.operator === '-='))
  }
  return matches ? target.array.name : null
}

const incrementMatches = (statement: JavaStatement, name: string) =>
  (statement.type === 'increment'
    && variableName(statement.target) === name
    && statement.delta === 1)
  || (statement.type === 'assignment'
    && variableName(statement.target) === name
    && statement.operator === '+='
    && isNumber(statement.value, 1))

const overflowRoles = (condition: JavaExpression, rightName: string) => {
  if (condition.type !== 'binary') return null
  const widthLeft = condition.operator === '>' && stringLength(condition.right, 'p')
    ? condition.left
    : condition.operator === '<' && stringLength(condition.left, 'p')
      ? condition.right
      : null
  if (
    widthLeft?.type !== 'binary'
    || widthLeft.operator !== '+'
    || !isNumber(widthLeft.right, 1)
    || widthLeft.left.type !== 'binary'
    || widthLeft.left.operator !== '-'
    || variableName(widthLeft.left.left) !== rightName
    || widthLeft.left.right.type !== 'variable'
  ) return null
  return { leftName: widthLeft.left.right.name }
}

const arraysEqual = (
  expression: JavaExpression,
  firstName: string,
  secondName: string,
) => expression.type === 'call'
  && expression.callee === 'Arrays.equals'
  && expression.args.length === 2
  && new Set(expression.args.map(variableName)).size === 2
  && expression.args.some((argument) => variableName(argument) === firstName)
  && expression.args.some((argument) => variableName(argument) === secondName)

const firstIssue = (checks: Record<string, boolean>): SemanticResult['issue'] => {
  const messages: Record<string, string> = {
    initialize: '先创建两份 26 格频谱、左边界和空的命中列表。',
    patternLoop: '目标读头需要从 0 遍历到 p.length()。',
    targetCount: '目标循环内要把 p 当前字母对应的目标频谱格加一。',
    patternScope: '目标字母计数必须位于目标扫描循环内部。',
    sourceLoop: '右探针需要从 0 遍历到 s.length()。',
    addIncoming: '源串每轮需要先把右探针字母加入窗口频谱。',
    overflowCondition: '纳入字母后，用 right - left + 1 与 p.length() 判断窗口是否超宽。',
    removeOutgoing: '窗口超宽时，先从频谱中扣除左边界字母。',
    leftAdvance: '旧字母移出后，再让左边界向右一步。',
    matchCondition: '窗口恢复宽度后，用 Arrays.equals 比较目标和窗口频谱。',
    recordIndex: '频谱一致时，把当前左边界追加到结果列表。',
    scopes: '纳入、收缩、匹配和记录需要按正确顺序嵌套在源串循环中。',
    returnResult: '扫描结束后需要返回同一个命中列表。',
  }
  const check = ANAGRAM_SEMANTIC_CHECKS.find((name) => !checks[name])
  return check ? { check, message: messages[check] } : undefined
}

export const analyzeAnagramProgram = (program: JavaProgram): SemanticResult => {
  const checks = Object.fromEntries(
    ANAGRAM_SEMANTIC_CHECKS.map((check) => [check, false]),
  ) as Record<string, boolean>
  const topLevel = program.statements

  const patternLoopIndex = topLevel.findIndex(
    (statement) => statement.type === 'for' && loopIndexName(statement, 'p') !== null,
  )
  const patternLoop = patternLoopIndex >= 0 ? topLevel[patternLoopIndex] as JavaFor : null
  const patternIndex = patternLoop ? loopIndexName(patternLoop, 'p') : null
  checks.patternLoop = Boolean(patternLoop && patternIndex)

  let targetName: string | null = null
  if (patternLoop && patternIndex) {
    const body = statementsOf(patternLoop.body)
    const countStatement = body.find((statement) => arrayDelta(statement, 'p', patternIndex, 1) !== null)
    targetName = countStatement ? arrayDelta(countStatement, 'p', patternIndex, 1) : null
    checks.targetCount = Boolean(targetName)
    checks.patternScope = Boolean(countStatement)
  }

  const sourceLoopIndex = topLevel.findIndex(
    (statement, index) => index > patternLoopIndex
      && statement.type === 'for'
      && loopIndexName(statement, 's') !== null,
  )
  const sourceLoop = sourceLoopIndex >= 0 ? topLevel[sourceLoopIndex] as JavaFor : null
  const rightName = sourceLoop ? loopIndexName(sourceLoop, 's') : null
  checks.sourceLoop = Boolean(sourceLoop && rightName)

  let windowName: string | null = null
  let leftName: string | null = null
  const listNames = topLevel
    .filter(
      (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
        statement.type === 'declaration' && statement.init?.type === 'new-list',
    )
    .map(({ name }) => name)
  const returnedListName = topLevel
    .slice(Math.max(0, sourceLoopIndex + 1))
    .find(
      (statement) => statement.type === 'return'
        && statement.value.type === 'variable'
        && listNames.includes(statement.value.name),
    )
  const resultName = returnedListName?.type === 'return'
    && returnedListName.value.type === 'variable'
    ? returnedListName.value.name
    : listNames[0] ?? null

  if (sourceLoop && rightName && targetName) {
    const body = statementsOf(sourceLoop.body)
    const addIndex = body.findIndex((statement) => arrayDelta(statement, 's', rightName, 1) !== null)
    windowName = addIndex >= 0 ? arrayDelta(body[addIndex], 's', rightName, 1) : null
    checks.addIncoming = Boolean(windowName)

    const overflowIndex = body.findIndex(
      (statement, index) => index > addIndex
        && statement.type === 'if'
        && overflowRoles(statement.condition, rightName) !== null,
    )
    const overflow = overflowIndex >= 0
      ? body[overflowIndex] as Extract<JavaStatement, { type: 'if' }>
      : null
    leftName = overflow ? overflowRoles(overflow.condition, rightName)?.leftName ?? null : null
    checks.overflowCondition = Boolean(overflow && leftName)

    const overflowBody = overflow ? statementsOf(overflow.consequent) : []
    const removeIndex = leftName && windowName
      ? overflowBody.findIndex((statement) => arrayDelta(statement, 's', leftName!, -1) === windowName)
      : -1
    checks.removeOutgoing = removeIndex >= 0
    const advanceIndex = leftName
      ? overflowBody.findIndex((statement) => incrementMatches(statement, leftName!))
      : -1
    checks.leftAdvance = removeIndex >= 0 && advanceIndex > removeIndex

    const matchIndex = body.findIndex(
      (statement, index) => index > overflowIndex
        && statement.type === 'if'
        && Boolean(windowName)
        && arraysEqual(statement.condition, targetName, windowName!),
    )
    const match = matchIndex >= 0
      ? body[matchIndex] as Extract<JavaStatement, { type: 'if' }>
      : null
    checks.matchCondition = Boolean(match)

    const matchBody = match ? statementsOf(match.consequent) : []
    const record = leftName && resultName
      ? matchBody.find((statement) => statement.type === 'expression'
        && statement.expression.type === 'call'
        && statement.expression.callee === `${resultName}.add`
        && statement.expression.args.length === 1
        && variableName(statement.expression.args[0]) === leftName)
      : null
    checks.recordIndex = Boolean(record)
    checks.scopes = addIndex >= 0
      && overflowIndex > addIndex
      && removeIndex >= 0
      && advanceIndex > removeIndex
      && matchIndex > overflowIndex
      && Boolean(record)
  }

  const declarations = topLevel.filter(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> => statement.type === 'declaration',
  )
  const targetDeclaration = targetName
    ? declarations.find((statement) => statement.name === targetName && newIntArrayLength(statement.init, 26))
    : null
  const windowDeclaration = windowName
    ? declarations.find((statement) => statement.name === windowName && newIntArrayLength(statement.init, 26))
    : null
  const leftDeclaration = leftName
    ? declarations.find((statement) => statement.name === leftName && isNumber(statement.init, 0))
    : null
  const resultDeclaration = resultName
    ? declarations.find((statement) => statement.name === resultName && statement.init?.type === 'new-list')
    : null
  checks.initialize = Boolean(
    targetDeclaration
    && windowDeclaration
    && targetName !== windowName
    && leftDeclaration
    && resultDeclaration,
  )

  checks.returnResult = Boolean(
    resultName
    && sourceLoopIndex >= 0
    && topLevel.slice(sourceLoopIndex + 1).some(
      (statement) => statement.type === 'return' && variableName(statement.value) === resultName,
    ),
  )

  const issue = firstIssue(checks)
  return { valid: !issue, checks, issue }
}
