import type { JavaExpression, JavaLValue, JavaProgram, JavaStatement } from '../../codePractice/javaSubset'
import type { SemanticResult } from '../types'

export const MINIMUM_WINDOW_SEMANTIC_CHECKS = [
  'initialize', 'targetLoop', 'readTarget', 'addTargetDebt', 'advanceTarget',
  'prepareWindow', 'sourceLoop', 'readIncoming', 'incomingCheck', 'reduceMissing',
  'debitIncoming', 'shrinkLoop', 'measureWindow', 'shorterCheck', 'saveBest',
  'readOutgoing', 'creditOutgoing', 'restoreCheck', 'increaseMissing',
  'advanceLeft', 'advanceRight', 'scopes', 'emptyResult', 'returnWindow',
] as const

const isNumber = (expression: JavaExpression | null, value: number) =>
  expression?.type === 'number' && expression.value === value

const variableName = (expression: JavaExpression | JavaLValue | null) =>
  expression?.type === 'variable' ? expression.name : null

const statementsOf = (statement: JavaStatement | null): JavaStatement[] =>
  statement?.type === 'block' ? statement.statements : statement ? [statement] : []

const isStringCall = (
  expression: JavaExpression | null,
  owner: string,
  method: string,
  argumentNames?: string[],
) => {
  if (expression?.type !== 'call' || expression.callee !== `${owner}.${method}`) return false
  if (!argumentNames) return expression.args.length === 0
  return expression.args.length === argumentNames.length
    && expression.args.every((argument, index) => variableName(argument) === argumentNames[index])
}

const isStringLength = (expression: JavaExpression | null, owner: string) =>
  isStringCall(expression, owner, 'length')

const isNewIntArray = (expression: JavaExpression | null, minimumLength = 128) => {
  if (!expression) return false
  const candidate = expression as unknown as { type?: string; elementType?: string; length?: JavaExpression }
  return candidate.type === 'new-array'
    && candidate.elementType === 'int'
    && candidate.length?.type === 'number'
    && candidate.length.value >= minimumLength
}

const isIncrement = (statement: JavaStatement, name: string, delta: 1 | -1) => {
  if (statement.type === 'increment') {
    return variableName(statement.target) === name && statement.delta === delta
  }
  return statement.type === 'assignment'
    && variableName(statement.target) === name
    && isNumber(statement.value, 1)
    && ((delta === 1 && statement.operator === '+=') || (delta === -1 && statement.operator === '-='))
}

const isArrayIncrement = (
  statement: JavaStatement,
  arrayName: string,
  indexName: string,
  delta: 1 | -1,
) => {
  if (statement.type !== 'increment' && statement.type !== 'assignment') return false
  const target = statement.target
  if (
    target.type !== 'array-access'
    || variableName(target.array) !== arrayName
    || variableName(target.index) !== indexName
  ) return false
  if (statement.type === 'increment') return statement.delta === delta
  return isNumber(statement.value, 1)
    && ((delta === 1 && statement.operator === '+=') || (delta === -1 && statement.operator === '-='))
}

const isArrayComparedToZero = (
  expression: JavaExpression,
  arrayName: string,
  indexName: string,
  relation: 'positive' | 'zero',
) => {
  if (expression.type !== 'binary') return false
  const access = (candidate: JavaExpression) => candidate.type === 'array-access'
    && variableName(candidate.array) === arrayName
    && variableName(candidate.index) === indexName
  if (relation === 'zero') {
    return expression.operator === '=='
      && ((access(expression.left) && isNumber(expression.right, 0))
        || (isNumber(expression.left, 0) && access(expression.right)))
  }
  return (access(expression.left) && isNumber(expression.right, 0) && expression.operator === '>')
    || (isNumber(expression.left, 0) && access(expression.right) && expression.operator === '<')
}

const isVariableComparedToZero = (expression: JavaExpression, name: string) =>
  expression.type === 'binary'
  && expression.operator === '=='
  && ((variableName(expression.left) === name && isNumber(expression.right, 0))
    || (isNumber(expression.left, 0) && variableName(expression.right) === name))

const scanPointer = (expression: JavaExpression, owner: string) => {
  if (expression.type !== 'binary') return null
  if (expression.operator === '<' && expression.left.type === 'variable' && isStringLength(expression.right, owner)) {
    return expression.left.name
  }
  if (expression.operator === '>' && isStringLength(expression.left, owner) && expression.right.type === 'variable') {
    return expression.right.name
  }
  return null
}

const isWindowLength = (
  expression: JavaExpression | null,
  rightName: string,
  leftName: string,
) => {
  if (expression?.type !== 'binary' || expression.operator !== '+') return false
  const difference = (candidate: JavaExpression) => candidate.type === 'binary'
    && candidate.operator === '-'
    && variableName(candidate.left) === rightName
    && variableName(candidate.right) === leftName
  return (difference(expression.left) && isNumber(expression.right, 1))
    || (isNumber(expression.left, 1) && difference(expression.right))
}

const isStrictlyShorter = (expression: JavaExpression, currentName: string, bestName: string) =>
  expression.type === 'binary'
  && ((expression.operator === '<'
    && variableName(expression.left) === currentName
    && variableName(expression.right) === bestName)
    || (expression.operator === '>'
      && variableName(expression.left) === bestName
      && variableName(expression.right) === currentName))

const assignmentMatches = (
  statement: JavaStatement,
  targetName: string,
  valueName: string,
) => statement.type === 'assignment'
  && statement.operator === '='
  && variableName(statement.target) === targetName
  && variableName(statement.value) === valueName

const firstIssue = (checks: Record<string, boolean>): SemanticResult['issue'] => {
  const messages: Record<string, string> = {
    initialize: '先创建至少 128 项的字符欠账数组，并把目标索引设为 0。',
    targetLoop: '用目标索引遍历 t.length()，逐字登记重复欠账。',
    readTarget: '目标登记循环中需要按目标索引读取 t 的当前字符。',
    addTargetDebt: '每个目标字符都需要让对应欠账加一，重复字符不能只登记一次。',
    advanceTarget: '每轮目标登记后，让目标索引前进一步。',
    prepareWindow: '登记完成后，建立左右边界、总欠账、最佳起点和无答案长度哨兵。',
    sourceLoop: '外层 while 需要让右边界在 s.length() 前持续工作。',
    readIncoming: '每轮先按右边界读取入窗字符。',
    incomingCheck: '在字符余额减一之前，先判断它是否仍有正欠账。',
    reduceMissing: '入窗字符仍有正欠账时，把总欠账减一。',
    debitIncoming: '完成补齐判断后，把入窗字符余额减一。',
    shrinkLoop: '总欠账为 0 时，需要用 while 持续收缩，不是只移动一次。',
    measureWindow: '收缩每轮先用 right - left + 1 计算当前窗口长度。',
    shorterCheck: '只有当前长度严格小于历史最短时，才更新封条。',
    saveBest: '更短窗口分支中需要同时保存当前左边界和当前长度。',
    readOutgoing: '最短记录检查后，按左边界读取出窗字符。',
    creditOutgoing: '先把出窗字符余额加一，再判断是否恢复欠账。',
    restoreCheck: '字符余额加回后为正，才说明窗口失去必要字符。',
    increaseMissing: '移出必要字符时，把总欠账加一。',
    advanceLeft: '完成出窗记账后，让左边界前进一步。',
    advanceRight: '本轮扩张与全部收缩结束后，让右边界前进一步。',
    scopes: '目标登记、源串扫描、覆盖收缩和三个条件分支需要保持正确嵌套。',
    emptyResult: '扫描后用长度哨兵识别无答案，并返回源串的空片段。',
    returnWindow: '有答案时按 bestStart 到 bestStart + bestLength 截取源字符串。',
  }
  const check = MINIMUM_WINDOW_SEMANTIC_CHECKS.find((name) => !checks[name])
  return check ? { check, message: messages[check] } : undefined
}

export const analyzeMinimumWindowProgram = (program: JavaProgram): SemanticResult => {
  const checks = Object.fromEntries(
    MINIMUM_WINDOW_SEMANTIC_CHECKS.map((check) => [check, false]),
  ) as Record<string, boolean>

  const targetLoopIndex = program.statements.findIndex(
    (statement) => statement.type === 'while' && scanPointer(statement.condition, 't') !== null,
  )
  const targetLoop = targetLoopIndex >= 0
    ? program.statements[targetLoopIndex] as Extract<JavaStatement, { type: 'while' }>
    : null
  const targetIndexName = targetLoop ? scanPointer(targetLoop.condition, 't') : null
  checks.targetLoop = Boolean(targetLoop && targetIndexName)

  const beforeTarget = targetLoopIndex >= 0
    ? program.statements.slice(0, targetLoopIndex)
    : program.statements
  const needDeclaration = beforeTarget.find(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
      statement.type === 'declaration' && isNewIntArray(statement.init),
  )
  const needName = needDeclaration?.name ?? null
  checks.initialize = Boolean(
    needName
    && targetIndexName
    && beforeTarget.some((statement) => statement.type === 'declaration'
      && statement.name === targetIndexName
      && isNumber(statement.init, 0)),
  )

  if (targetLoop && targetIndexName && needName) {
    const body = statementsOf(targetLoop.body)
    const readIndex = body.findIndex((statement) => statement.type === 'declaration'
      && isStringCall(statement.init, 't', 'charAt', [targetIndexName]))
    const read = readIndex >= 0
      ? body[readIndex] as Extract<JavaStatement, { type: 'declaration' }>
      : null
    const targetCharacterName = read?.name ?? null
    const debtIndex = targetCharacterName
      ? body.findIndex((statement) => isArrayIncrement(statement, needName, targetCharacterName, 1))
      : -1
    const advanceIndex = body.findIndex((statement) => isIncrement(statement, targetIndexName, 1))
    checks.readTarget = readIndex >= 0
    checks.addTargetDebt = readIndex >= 0 && debtIndex > readIndex
    checks.advanceTarget = debtIndex >= 0 && advanceIndex > debtIndex
  }

  const sourceLoopIndex = program.statements.findIndex(
    (statement, index) => index > targetLoopIndex
      && statement.type === 'while'
      && scanPointer(statement.condition, 's') !== null,
  )
  const sourceLoop = sourceLoopIndex >= 0
    ? program.statements[sourceLoopIndex] as Extract<JavaStatement, { type: 'while' }>
    : null
  const rightName = sourceLoop ? scanPointer(sourceLoop.condition, 's') : null
  checks.sourceLoop = Boolean(sourceLoop && rightName)

  const beforeSource = sourceLoopIndex >= 0
    ? program.statements.slice(targetLoopIndex + 1, sourceLoopIndex)
    : []
  const zeroDeclarations = beforeSource.filter(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
      statement.type === 'declaration' && isNumber(statement.init, 0),
  )
  const rightDeclaration = rightName
    ? zeroDeclarations.find((statement) => statement.name === rightName)
    : null
  const missingDeclaration = beforeSource.find(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
      statement.type === 'declaration' && isStringLength(statement.init, 't'),
  )
  const sentinelDeclaration = beforeSource.find(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
      statement.type === 'declaration'
      && statement.init?.type === 'binary'
      && statement.init.operator === '+'
      && ((isStringLength(statement.init.left, 's') && isNumber(statement.init.right, 1))
        || (isNumber(statement.init.left, 1) && isStringLength(statement.init.right, 's'))),
  )
  const leftDeclaration = zeroDeclarations.find((statement) => statement.name !== rightName)
  const bestStartDeclaration = zeroDeclarations.find(
    (statement) => statement.name !== rightName && statement.name !== leftDeclaration?.name,
  )
  const leftName = leftDeclaration?.name ?? null
  const missingName = missingDeclaration?.name ?? null
  const bestLengthName = sentinelDeclaration?.name ?? null
  const bestStartName = bestStartDeclaration?.name ?? null
  checks.prepareWindow = Boolean(
    rightDeclaration && leftName && missingName && bestLengthName && bestStartName,
  )

  if (sourceLoop && rightName && leftName && missingName && bestLengthName && bestStartName && needName) {
    const body = statementsOf(sourceLoop.body)
    const incomingReadIndex = body.findIndex((statement) => statement.type === 'declaration'
      && isStringCall(statement.init, 's', 'charAt', [rightName]))
    const incomingRead = incomingReadIndex >= 0
      ? body[incomingReadIndex] as Extract<JavaStatement, { type: 'declaration' }>
      : null
    const incomingName = incomingRead?.name ?? null
    checks.readIncoming = incomingReadIndex >= 0

    const incomingIfIndex = incomingName
      ? body.findIndex((statement) => statement.type === 'if'
        && isArrayComparedToZero(statement.condition, needName, incomingName, 'positive'))
      : -1
    const incomingIf = incomingIfIndex >= 0
      ? body[incomingIfIndex] as Extract<JavaStatement, { type: 'if' }>
      : null
    const reduceIndex = incomingIf
      ? statementsOf(incomingIf.consequent).findIndex((statement) => isIncrement(statement, missingName, -1))
      : -1
    const debitIndex = incomingName
      ? body.findIndex((statement) => isArrayIncrement(statement, needName, incomingName, -1))
      : -1
    checks.incomingCheck = incomingReadIndex >= 0 && incomingIfIndex > incomingReadIndex
    checks.reduceMissing = reduceIndex >= 0
    checks.debitIncoming = incomingIfIndex >= 0 && debitIndex > incomingIfIndex

    const shrinkIndex = body.findIndex((statement) => statement.type === 'while'
      && isVariableComparedToZero(statement.condition, missingName))
    const shrink = shrinkIndex >= 0
      ? body[shrinkIndex] as Extract<JavaStatement, { type: 'while' }>
      : null
    checks.shrinkLoop = debitIndex >= 0 && shrinkIndex > debitIndex

    if (shrink) {
      const shrinkBody = statementsOf(shrink.body)
      const measureIndex = shrinkBody.findIndex((statement) => statement.type === 'declaration'
        && isWindowLength(statement.init, rightName, leftName))
      const measure = measureIndex >= 0
        ? shrinkBody[measureIndex] as Extract<JavaStatement, { type: 'declaration' }>
        : null
      const currentLengthName = measure?.name ?? null
      checks.measureWindow = measureIndex >= 0

      const shorterIndex = currentLengthName
        ? shrinkBody.findIndex((statement) => statement.type === 'if'
          && isStrictlyShorter(statement.condition, currentLengthName, bestLengthName))
        : -1
      const shorter = shorterIndex >= 0
        ? shrinkBody[shorterIndex] as Extract<JavaStatement, { type: 'if' }>
        : null
      checks.shorterCheck = measureIndex >= 0 && shorterIndex > measureIndex
      if (shorter && currentLengthName) {
        const saveBody = statementsOf(shorter.consequent)
        const startSave = saveBody.findIndex((statement) => assignmentMatches(statement, bestStartName, leftName))
        const lengthSave = saveBody.findIndex((statement) => assignmentMatches(statement, bestLengthName, currentLengthName))
        checks.saveBest = startSave >= 0 && lengthSave >= 0
      }

      const outgoingReadIndex = shrinkBody.findIndex((statement) => statement.type === 'declaration'
        && isStringCall(statement.init, 's', 'charAt', [leftName]))
      const outgoingRead = outgoingReadIndex >= 0
        ? shrinkBody[outgoingReadIndex] as Extract<JavaStatement, { type: 'declaration' }>
        : null
      const outgoingName = outgoingRead?.name ?? null
      checks.readOutgoing = shorterIndex >= 0 && outgoingReadIndex > shorterIndex

      const creditIndex = outgoingName
        ? shrinkBody.findIndex((statement) => isArrayIncrement(statement, needName, outgoingName, 1))
        : -1
      checks.creditOutgoing = outgoingReadIndex >= 0 && creditIndex > outgoingReadIndex

      const restoreIndex = outgoingName
        ? shrinkBody.findIndex((statement) => statement.type === 'if'
          && isArrayComparedToZero(statement.condition, needName, outgoingName, 'positive'))
        : -1
      const restore = restoreIndex >= 0
        ? shrinkBody[restoreIndex] as Extract<JavaStatement, { type: 'if' }>
        : null
      checks.restoreCheck = creditIndex >= 0 && restoreIndex > creditIndex
      checks.increaseMissing = Boolean(
        restore && statementsOf(restore.consequent).some((statement) => isIncrement(statement, missingName, 1)),
      )
      const leftAdvanceIndex = shrinkBody.findIndex((statement) => isIncrement(statement, leftName, 1))
      checks.advanceLeft = restoreIndex >= 0 && leftAdvanceIndex > restoreIndex
    }

    const rightAdvanceIndex = body.findIndex((statement) => isIncrement(statement, rightName, 1))
    checks.advanceRight = shrinkIndex >= 0 && rightAdvanceIndex > shrinkIndex
    checks.scopes = checks.targetLoop && checks.sourceLoop && checks.shrinkLoop
      && checks.incomingCheck && checks.shorterCheck && checks.restoreCheck
  }

  const afterSource = sourceLoopIndex >= 0 ? program.statements.slice(sourceLoopIndex + 1) : []
  if (bestLengthName && bestStartName) {
    const emptyIfIndex = afterSource.findIndex((statement) => {
      if (statement.type !== 'if' || statement.condition.type !== 'binary') return false
      const condition = statement.condition
      const sentinelLeft = variableName(condition.left) === bestLengthName && isStringLength(condition.right, 's')
      const sentinelRight = isStringLength(condition.left, 's') && variableName(condition.right) === bestLengthName
      return (sentinelLeft && condition.operator === '>') || (sentinelRight && condition.operator === '<')
    })
    const emptyIf = emptyIfIndex >= 0
      ? afterSource[emptyIfIndex] as Extract<JavaStatement, { type: 'if' }>
      : null
    checks.emptyResult = Boolean(emptyIf && statementsOf(emptyIf.consequent).some((statement) => (
      statement.type === 'return'
      && statement.value.type === 'call'
      && statement.value.callee === 's.substring'
      && statement.value.args.length === 2
      && statement.value.args.every((argument) => isNumber(argument, 0))
    )))

    checks.returnWindow = afterSource.some((statement, index) => {
      if (index <= emptyIfIndex || statement.type !== 'return' || statement.value.type !== 'call') return false
      const value = statement.value
      if (value.callee !== 's.substring' || value.args.length !== 2) return false
      const [start, end] = value.args
      return variableName(start) === bestStartName
        && end.type === 'binary'
        && end.operator === '+'
        && ((variableName(end.left) === bestStartName && variableName(end.right) === bestLengthName)
          || (variableName(end.left) === bestLengthName && variableName(end.right) === bestStartName))
    })
  }

  return { valid: MINIMUM_WINDOW_SEMANTIC_CHECKS.every((check) => checks[check]), checks, issue: firstIssue(checks) }
}
