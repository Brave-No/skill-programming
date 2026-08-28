import type {
  JavaExpression,
  JavaLValue,
  JavaProgram,
  JavaStatement,
} from '../../codePractice/javaSubset'
import type { SemanticResult } from '../types'

export const ARCHIVE_SEMANTIC_CHECKS = [
  'archive',
  'state',
  'scan',
  'prefixUpdate',
  'needed',
  'count',
  'record',
  'advance',
  'scope',
  'result',
] as const

const statementsOf = (statement: JavaStatement | null) =>
  statement?.type === 'block' ? statement.statements : statement ? [statement] : []

const variableName = (expression: JavaExpression | JavaLValue | null) =>
  expression?.type === 'variable' ? expression.name : null

const isNumber = (expression: JavaExpression | null, value: number) =>
  expression?.type === 'number' && expression.value === value

const declaration = (statements: JavaStatement[], name: string) =>
  statements.find(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
      statement.type === 'declaration' && statement.name === name,
  )

const isNumsAt = (expression: JavaExpression, indexName: string) =>
  expression.type === 'array-access'
  && variableName(expression.array) === 'nums'
  && variableName(expression.index) === indexName

const scanIndexFrom = (condition: JavaExpression) => {
  if (condition.type !== 'binary') return null
  if (
    condition.operator === '<'
    && condition.left.type === 'variable'
    && condition.right.type === 'length'
    && variableName(condition.right.array) === 'nums'
  ) return condition.left.name
  if (
    condition.operator === '>'
    && condition.left.type === 'length'
    && variableName(condition.left.array) === 'nums'
    && condition.right.type === 'variable'
  ) return condition.right.name
  return null
}

const prefixUpdatedBy = (statement: JavaStatement, indexName: string) => {
  if (statement.type !== 'assignment' || statement.target.type !== 'variable') return null
  const prefixName = statement.target.name
  if (statement.operator === '+=' && isNumsAt(statement.value, indexName)) return prefixName
  if (statement.operator !== '=' || statement.value.type !== 'binary' || statement.value.operator !== '+') return null
  const leftIsPrefix = variableName(statement.value.left) === prefixName
  const rightIsPrefix = variableName(statement.value.right) === prefixName
  if (leftIsPrefix && isNumsAt(statement.value.right, indexName)) return prefixName
  if (rightIsPrefix && isNumsAt(statement.value.left, indexName)) return prefixName
  return null
}

const isDifference = (expression: JavaExpression, prefixName: string) =>
  expression.type === 'binary'
  && expression.operator === '-'
  && variableName(expression.left) === prefixName
  && variableName(expression.right) === 'k'

const isMapCall = (
  expression: JavaExpression,
  mapName: string,
  method: 'getOrDefault' | 'put',
  argumentCount: number,
): expression is Extract<JavaExpression, { type: 'call' }> => expression.type === 'call'
  && expression.callee === `${mapName}.${method}`
  && expression.args.length === argumentCount

const isLookup = (
  expression: JavaExpression,
  mapName: string,
  keyMatches: (key: JavaExpression) => boolean,
) => isMapCall(expression, mapName, 'getOrDefault', 2)
  && keyMatches(expression.args[0])
  && isNumber(expression.args[1], 0)

const lookupInCount = (
  statement: JavaStatement,
  mapName: string,
  keyMatches: (key: JavaExpression) => boolean,
) => {
  if (statement.type !== 'assignment' || statement.target.type !== 'variable') return null
  const countName = statement.target.name
  if (statement.operator === '+=' && isLookup(statement.value, mapName, keyMatches)) return countName
  if (statement.operator !== '=' || statement.value.type !== 'binary' || statement.value.operator !== '+') return null
  const leftIsCount = variableName(statement.value.left) === countName
  const rightIsCount = variableName(statement.value.right) === countName
  if (leftIsCount && isLookup(statement.value.right, mapName, keyMatches)) return countName
  if (rightIsCount && isLookup(statement.value.left, mapName, keyMatches)) return countName
  return null
}

const isPlusOne = (expression: JavaExpression, baseMatches: (base: JavaExpression) => boolean) =>
  expression.type === 'binary'
  && expression.operator === '+'
  && (
    (baseMatches(expression.left) && isNumber(expression.right, 1))
    || (isNumber(expression.left, 1) && baseMatches(expression.right))
  )

const recordsPrefix = (
  statement: JavaStatement,
  mapName: string,
  prefixName: string,
) => {
  if (statement.type !== 'expression') return false
  const call = statement.expression
  return isMapCall(call, mapName, 'put', 2)
    && variableName(call.args[0]) === prefixName
    && isPlusOne(
      call.args[1],
      (base) => isLookup(base, mapName, (key) => variableName(key) === prefixName),
    )
}

const seedsArchive = (statement: JavaStatement, mapName: string) => {
  if (statement.type !== 'expression') return false
  const call = statement.expression
  return isMapCall(call, mapName, 'put', 2)
    && isNumber(call.args[0], 0)
    && isNumber(call.args[1], 1)
}

const advances = (statement: JavaStatement, indexName: string) => {
  if (
    statement.type === 'increment'
    && statement.delta === 1
    && variableName(statement.target) === indexName
  ) return true
  if (
    statement.type === 'assignment'
    && variableName(statement.target) === indexName
    && statement.operator === '+='
    && isNumber(statement.value, 1)
  ) return true
  return statement.type === 'assignment'
    && variableName(statement.target) === indexName
    && statement.operator === '='
    && statement.value.type === 'binary'
    && statement.value.operator === '+'
    && (
      (variableName(statement.value.left) === indexName && isNumber(statement.value.right, 1))
      || (isNumber(statement.value.left, 1) && variableName(statement.value.right) === indexName)
    )
}

const firstIssue = (checks: Record<string, boolean>): SemanticResult['issue'] => {
  const messages: Record<string, string> = {
    archive: '先创建整数前缀频次表，并在巡查前登记起点档案 0 -> 1。',
    state: '探针、累计刻度和命中计数都需要在循环前从 0 开始。',
    scan: 'while 需要在探针到达 nums.length 前持续巡查。',
    prefixUpdate: '每轮第一步需要把 nums[index] 累加到同一个前缀和。',
    needed: '前缀更新后，需要计算 prefixSum - k 作为目标旧前缀。',
    count: '登记当前前缀之前，需要用 getOrDefault 查询旧前缀次数并累加答案。',
    record: '查询结束后，需要用 put 把当前前缀的历史次数增加一。',
    advance: '本轮档案写回后，需要让探针前进一格。',
    scope: '累加、求差、查询、登记和前进必须按顺序位于同一个巡查作用域。',
    result: '巡查结束后需要返回同一个命中计数变量。',
  }
  const check = ARCHIVE_SEMANTIC_CHECKS.find((name) => !checks[name])
  return check ? { check, message: messages[check] } : undefined
}

export const analyzeArchiveJavaProgram = (program: JavaProgram): SemanticResult => {
  const checks = Object.fromEntries(
    ARCHIVE_SEMANTIC_CHECKS.map((check) => [check, false]),
  ) as Record<string, boolean>

  const loopIndex = program.statements.findIndex(
    (statement) => statement.type === 'while' && scanIndexFrom(statement.condition) !== null,
  )
  const loop = loopIndex >= 0
    ? program.statements[loopIndex] as Extract<JavaStatement, { type: 'while' }>
    : null
  const beforeLoop = loopIndex >= 0 ? program.statements.slice(0, loopIndex) : program.statements
  const afterLoop = loopIndex >= 0 ? program.statements.slice(loopIndex + 1) : []
  const indexName = loop ? scanIndexFrom(loop.condition) : null
  checks.scan = Boolean(loop && indexName)

  const mapDeclarations = beforeLoop.filter(
    (statement): statement is Extract<JavaStatement, { type: 'declaration' }> =>
      statement.type === 'declaration'
      && statement.valueType === 'map'
      && statement.init?.type === 'new-map',
  )

  if (loop && indexName) {
    const body = statementsOf(loop.body)
    const prefixUpdateIndex = body.findIndex((statement) => Boolean(prefixUpdatedBy(statement, indexName)))
    const prefixName = prefixUpdateIndex >= 0
      ? prefixUpdatedBy(body[prefixUpdateIndex], indexName)
      : null
    checks.prefixUpdate = Boolean(prefixName)

    for (const mapDeclaration of mapDeclarations) {
      if (!prefixName) continue
      const mapName = mapDeclaration.name
      const seeded = beforeLoop.some((statement) => seedsArchive(statement, mapName))
      checks.archive = seeded

      const neededIndex = body.findIndex(
        (statement, index) => index > prefixUpdateIndex
          && (
            (statement.type === 'declaration'
              && statement.valueType === 'int'
              && Boolean(statement.init && isDifference(statement.init, prefixName)))
            || (statement.type === 'assignment'
              && statement.operator === '='
              && statement.target.type === 'variable'
              && isDifference(statement.value, prefixName))
          ),
      )
      const neededStatement = neededIndex >= 0 ? body[neededIndex] : null
      const neededName = neededStatement?.type === 'declaration'
        ? neededStatement.name
        : neededStatement?.type === 'assignment' && neededStatement.target.type === 'variable'
          ? neededStatement.target.name
          : null
      const keyMatches = (key: JavaExpression) => (
        (neededName !== null && variableName(key) === neededName)
        || isDifference(key, prefixName)
      )

      const countIndex = body.findIndex(
        (statement, index) => index > prefixUpdateIndex
          && lookupInCount(statement, mapName, keyMatches) !== null,
      )
      const countName = countIndex >= 0
        ? lookupInCount(body[countIndex], mapName, keyMatches)
        : null
      checks.needed = neededIndex > prefixUpdateIndex || countIndex > prefixUpdateIndex
      checks.count = Boolean(countName && countIndex > prefixUpdateIndex)

      const recordIndex = body.findIndex(
        (statement, index) => index > countIndex && recordsPrefix(statement, mapName, prefixName),
      )
      checks.record = countIndex >= 0 && recordIndex > countIndex

      const advanceIndex = body.findIndex(
        (statement, index) => index > recordIndex && advances(statement, indexName),
      )
      checks.advance = recordIndex >= 0 && advanceIndex > recordIndex

      const indexDeclaration = declaration(beforeLoop, indexName)
      const prefixDeclaration = declaration(beforeLoop, prefixName)
      const countDeclaration = countName ? declaration(beforeLoop, countName) : null
      checks.state = Boolean(
        indexDeclaration && isNumber(indexDeclaration.init, 0)
        && prefixDeclaration && isNumber(prefixDeclaration.init, 0)
        && countDeclaration && isNumber(countDeclaration.init, 0),
      )
      checks.scope = prefixUpdateIndex >= 0
        && (neededIndex > prefixUpdateIndex || countIndex > prefixUpdateIndex)
        && countIndex > prefixUpdateIndex
        && recordIndex > countIndex
        && advanceIndex > recordIndex
      checks.result = Boolean(
        countName
        && afterLoop.some(
          (statement) => statement.type === 'return' && variableName(statement.value) === countName,
        ),
      )

      if (ARCHIVE_SEMANTIC_CHECKS.every((check) => checks[check])) break
    }
  }

  const issue = firstIssue(checks)
  return { valid: !issue, checks, issue }
}
