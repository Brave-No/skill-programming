import type {
  JavaExpression,
  JavaLValue,
  JavaProgram,
  JavaStatement,
} from './javaSubset'

export interface MoveZeroesSemanticChecks {
  preparation: boolean
  loopInit: boolean
  loopCondition: boolean
  loopUpdate: boolean
  occupiedCondition: boolean
  swap: boolean
  slowUpdate: boolean
  forScope: boolean
  ifScope: boolean
}

export interface MoveZeroesSemanticAnalysis {
  checks: MoveZeroesSemanticChecks
  fastPointer: string | null
  slowPointer: string | null
  lengthAliases: Set<string>
}

const isNumber = (expression: JavaExpression | number[] | null, value: number) =>
  !Array.isArray(expression) && expression?.type === 'number' && expression.value === value

const variableName = (expression: JavaExpression | JavaLValue) =>
  expression.type === 'variable' ? expression.name : null

const statementsOf = (statement: JavaStatement | null) =>
  statement?.type === 'block' ? statement.statements : statement ? [statement] : []

const arrayIndexName = (expression: JavaExpression | JavaLValue) => {
  if (expression.type !== 'array-access') return null
  if (expression.array.type !== 'variable' || expression.array.name !== 'nums') return null
  return variableName(expression.index)
}

const assignedZeroName = (statement: JavaStatement | null) => {
  if (!statement) return null
  if (statement.type === 'declaration' && statement.valueType === 'int' && isNumber(statement.init, 0)) {
    return statement.name
  }
  if (
    statement.type === 'assignment'
    && statement.operator === '='
    && statement.target.type === 'variable'
    && isNumber(statement.value, 0)
  ) {
    return statement.target.name
  }
  return null
}

const incrementedName = (statement: JavaStatement | null) => {
  if (!statement) return null
  if (statement.type === 'increment' && statement.delta === 1 && statement.target.type === 'variable') {
    return statement.target.name
  }
  if (
    statement.type === 'assignment'
    && statement.operator === '+='
    && statement.target.type === 'variable'
    && isNumber(statement.value, 1)
  ) {
    return statement.target.name
  }
  return null
}

const isNumsLength = (expression: JavaExpression) =>
  expression.type === 'length'
  && expression.array.type === 'variable'
  && expression.array.name === 'nums'

const collectLengthAliases = (statements: JavaStatement[]) => {
  const aliases = new Set<string>()
  for (const statement of statements) {
    if (statement.type === 'declaration' && !Array.isArray(statement.init) && statement.init && isNumsLength(statement.init)) {
      aliases.add(statement.name)
    }
    if (
      statement.type === 'assignment'
      && statement.operator === '='
      && statement.target.type === 'variable'
      && isNumsLength(statement.value)
    ) {
      aliases.add(statement.target.name)
    }
  }
  return aliases
}

const isLengthValue = (expression: JavaExpression, aliases: Set<string>) =>
  isNumsLength(expression)
  || (expression.type === 'variable' && aliases.has(expression.name))

const isLoopBoundary = (
  expression: JavaExpression,
  fastPointer: string,
  lengthAliases: Set<string>,
) => {
  if (expression.type !== 'binary') return false
  return (
    expression.operator === '<'
    && variableName(expression.left) === fastPointer
    && isLengthValue(expression.right, lengthAliases)
  ) || (
    expression.operator === '>'
    && isLengthValue(expression.left, lengthAliases)
    && variableName(expression.right) === fastPointer
  )
}

const isOccupiedCondition = (expression: JavaExpression, fastPointer: string) => {
  if (expression.type !== 'binary' || expression.operator !== '!=') return false
  const leftIsCargo = arrayIndexName(expression.left) === fastPointer
  const rightIsCargo = arrayIndexName(expression.right) === fastPointer
  return (leftIsCargo && isNumber(expression.right, 0)) || (rightIsCargo && isNumber(expression.left, 0))
}

const findIf = (statement: JavaStatement) => {
  if (statement.type === 'if') return statement
  if (statement.type !== 'block') return null
  return statement.statements.find((child) => child.type === 'if') as Extract<JavaStatement, { type: 'if' }> | undefined ?? null
}

interface SwapMatch {
  found: boolean
  slowPointer: string | null
  endIndex: number
}

const findSwap = (statements: JavaStatement[], fastPointer: string | null): SwapMatch => {
  if (!fastPointer) return { found: false, slowPointer: null, endIndex: -1 }

  for (let index = 0; index <= statements.length - 3; index += 1) {
    const temporary = statements[index]
    const firstWrite = statements[index + 1]
    const secondWrite = statements[index + 2]
    if (
      temporary.type !== 'declaration'
      || temporary.valueType !== 'int'
      || Array.isArray(temporary.init)
      || !temporary.init
      || firstWrite.type !== 'assignment'
      || firstWrite.operator !== '='
      || secondWrite.type !== 'assignment'
      || secondWrite.operator !== '='
    ) continue

    const savedIndex = arrayIndexName(temporary.init)
    const firstTargetIndex = arrayIndexName(firstWrite.target)
    const firstValueIndex = arrayIndexName(firstWrite.value)
    const secondTargetIndex = arrayIndexName(secondWrite.target)
    const secondValueName = variableName(secondWrite.value)
    if (
      !savedIndex
      || firstTargetIndex !== savedIndex
      || !firstValueIndex
      || secondTargetIndex !== firstValueIndex
      || secondValueName !== temporary.name
    ) continue

    const pointers = new Set([savedIndex, firstValueIndex])
    if (!pointers.has(fastPointer) || pointers.size !== 2) continue
    const slowPointer = savedIndex === fastPointer ? firstValueIndex : savedIndex
    return { found: true, slowPointer, endIndex: index + 2 }
  }

  return { found: false, slowPointer: null, endIndex: -1 }
}

const hasZeroInitialization = (statements: JavaStatement[], name: string | null) =>
  Boolean(name && statements.some((statement) => assignedZeroName(statement) === name))

export const analyzeMoveZeroesProgram = (program: JavaProgram): MoveZeroesSemanticAnalysis => {
  const loopIndex = program.statements.findIndex((statement) => statement.type === 'for')
  const beforeLoop = loopIndex >= 0 ? program.statements.slice(0, loopIndex) : program.statements
  const loop = loopIndex >= 0
    ? program.statements[loopIndex] as Extract<JavaStatement, { type: 'for' }>
    : null
  const lengthAliases = collectLengthAliases(beforeLoop)
  const fastPointer = assignedZeroName(loop?.init ?? null)
  const loopCondition = Boolean(loop && fastPointer && isLoopBoundary(loop.condition, fastPointer, lengthAliases))
  const loopUpdate = Boolean(loop && fastPointer && incrementedName(loop.update) === fastPointer)
  const occupiedIf = loop ? findIf(loop.body) : null
  const occupiedCondition = Boolean(
    occupiedIf && fastPointer && isOccupiedCondition(occupiedIf.condition, fastPointer),
  )
  const occupiedStatements = statementsOf(occupiedIf?.consequent ?? null)
  const swap = findSwap(occupiedStatements, fastPointer)
  const incrementCandidates = occupiedStatements
    .map((statement, index) => ({ name: incrementedName(statement), index }))
    .filter((candidate): candidate is { name: string; index: number } => Boolean(candidate.name))
  const slowUpdate = swap.found
    ? incrementCandidates.find((candidate) => candidate.name === swap.slowPointer && candidate.index > swap.endIndex) ?? null
    : incrementCandidates.find((candidate) => candidate.name !== fastPointer) ?? null
  const slowPointer = swap.slowPointer ?? slowUpdate?.name ?? null

  return {
    fastPointer,
    slowPointer,
    lengthAliases,
    checks: {
      preparation: hasZeroInitialization(beforeLoop, slowPointer),
      loopInit: Boolean(fastPointer),
      loopCondition,
      loopUpdate,
      occupiedCondition,
      swap: swap.found,
      slowUpdate: Boolean(slowUpdate && slowPointer),
      forScope: Boolean(loop),
      ifScope: Boolean(occupiedIf),
    },
  }
}
