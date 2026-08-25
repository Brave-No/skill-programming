export type JavaDiagnosticKind = 'syntax' | 'unsupported' | 'runtime' | 'timeout' | 'output'

export interface JavaDiagnostic {
  kind: JavaDiagnosticKind
  message: string
  line: number
  column: number
}

export interface JavaRunResult {
  ok: boolean
  kind: 'success' | JavaDiagnosticKind
  message: string
  values?: number[]
  expected?: number[]
  diagnostic?: JavaDiagnostic
  steps: number
}

export interface JavaToken {
  value: string
  line: number
  column: number
}

export type JavaExpression =
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'variable'; name: string }
  | { type: 'array-access'; array: JavaExpression; index: JavaExpression }
  | { type: 'length'; array: JavaExpression }
  | { type: 'unary'; operator: '!' | '-' | '+'; operand: JavaExpression }
  | { type: 'binary'; operator: string; left: JavaExpression; right: JavaExpression }

export type JavaLValue =
  | { type: 'variable'; name: string; line: number; column: number }
  | { type: 'array-access'; array: JavaExpression; index: JavaExpression; line: number; column: number }

export type JavaStatement =
  | { type: 'block'; statements: JavaStatement[] }
  | { type: 'declaration'; name: string; valueType: 'int' | 'int[]'; init: JavaExpression | number[] | null; line: number; column: number }
  | { type: 'assignment'; target: JavaLValue; operator: '=' | '+=' | '-='; value: JavaExpression }
  | { type: 'increment'; target: JavaLValue; delta: 1 | -1 }
  | { type: 'if'; condition: JavaExpression; consequent: JavaStatement; alternate: JavaStatement | null }
  | { type: 'for'; init: JavaStatement | null; condition: JavaExpression; update: JavaStatement; body: JavaStatement }

export interface JavaProgram {
  type: 'program'
  statements: JavaStatement[]
}

class JavaSubsetError extends Error {
  readonly diagnostic: JavaDiagnostic

  constructor(diagnostic: JavaDiagnostic) {
    super(diagnostic.message)
    this.name = 'JavaSubsetError'
    this.diagnostic = diagnostic
  }
}

const fail = (
  kind: JavaDiagnosticKind,
  message: string,
  token: Pick<JavaToken, 'line' | 'column'>,
): never => {
  throw new JavaSubsetError({ kind, message, line: token.line, column: token.column })
}

const KEYWORDS = new Set(['int', 'for', 'if', 'else', 'true', 'false'])
const TWO_CHAR_OPERATORS = ['++', '--', '+=', '-=', '<=', '>=', '==', '!=', '&&', '||']
const SINGLE_CHAR_OPERATORS = new Set(['{', '}', '(', ')', '[', ']', ';', '.', '=', '+', '-', '*', '/', '%', '!', '<', '>', ','])

export const tokenizeJavaSubset = (source: string): JavaToken[] => {
  const tokens: JavaToken[] = []
  let index = 0
  let line = 1
  let column = 1

  const advance = () => {
    const character = source[index]
    index += 1
    if (character === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }

  while (index < source.length) {
    const character = source[index]
    if (/\s/.test(character)) {
      advance()
      continue
    }

    if (character === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') advance()
      continue
    }

    if (character === '/' && source[index + 1] === '*') {
      const start = { line, column }
      advance()
      advance()
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        advance()
      }
      if (index >= source.length) fail('syntax', '多行注释没有闭合。', start)
      advance()
      advance()
      continue
    }

    const start = { line, column }
    if (/[A-Za-z_]/.test(character)) {
      let value = ''
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) {
        value += source[index]
        advance()
      }
      tokens.push({ value, line: start.line, column: start.column })
      continue
    }

    if (/\d/.test(character)) {
      let value = ''
      while (index < source.length && /\d/.test(source[index])) {
        value += source[index]
        advance()
      }
      tokens.push({ value, line: start.line, column: start.column })
      continue
    }

    const twoCharacter = source.slice(index, index + 2)
    if (TWO_CHAR_OPERATORS.includes(twoCharacter)) {
      tokens.push({ value: twoCharacter, line: start.line, column: start.column })
      advance()
      advance()
      continue
    }

    if (SINGLE_CHAR_OPERATORS.has(character)) {
      tokens.push({ value: character, line: start.line, column: start.column })
      advance()
      continue
    }

    fail('unsupported', `暂不支持 Java 字符“${character}”。`, start)
  }

  tokens.push({ value: '<eof>', line, column })
  return tokens
}

const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
}

class JavaParser {
  private readonly tokens: JavaToken[]
  private index = 0

  constructor(source: string) {
    this.tokens = tokenizeJavaSubset(source)
  }

  private current() {
    return this.tokens[this.index]
  }

  private matches(value: string) {
    return this.current().value === value
  }

  private consume(value?: string) {
    const token = this.current()
    if (value && token.value !== value) {
      fail('syntax', `这里需要“${value}”，但读到了“${token.value}”。`, token)
    }
    this.index += 1
    return token
  }

  private expectIdentifier(label = '变量名') {
    const token = this.current()
    if (!/^[A-Za-z_]\w*$/.test(token.value) || KEYWORDS.has(token.value)) {
      fail('syntax', `这里需要${label}。`, token)
    }
    this.index += 1
    return token
  }

  parse(): JavaProgram {
    const statements: JavaStatement[] = []
    while (!this.matches('<eof>')) statements.push(this.parseStatement())
    return { type: 'program', statements }
  }

  private parseStatement(): JavaStatement {
    if (this.matches('{')) return this.parseBlock()
    if (this.matches('for')) return this.parseFor()
    if (this.matches('if')) return this.parseIf()
    if (this.matches(';')) {
      this.consume(';')
      return { type: 'block', statements: [] }
    }
    if (this.matches('int')) return this.parseDeclaration(true)
    if (/^[A-Za-z_]\w*$/.test(this.current().value)) return this.parseSimpleStatement(true)

    if (['while', 'do', 'switch', 'class', 'public', 'private', 'protected', 'static', 'void', 'return'].includes(this.current().value)) {
      fail('unsupported', `暂不支持“${this.current().value}”语法；当前编辑器只执行变量、for、if 和数组交换。`, this.current())
    }
    return fail('syntax', '这里不是一个可执行的 Java 语句。', this.current())
  }

  private parseBlock(): JavaStatement {
    this.consume('{')
    const statements: JavaStatement[] = []
    while (!this.matches('}') && !this.matches('<eof>')) statements.push(this.parseStatement())
    if (this.matches('<eof>')) fail('syntax', '代码块没有闭合。', this.current())
    this.consume('}')
    return { type: 'block', statements }
  }

  private parseFor(): JavaStatement {
    const start = this.consume('for')
    this.consume('(')
    const init = this.matches(';') ? null : this.matches('int') ? this.parseDeclaration(false) : this.parseSimpleStatement(false)
    this.consume(';')
    const condition = this.parseExpression()
    this.consume(';')
    const update = this.parseSimpleStatement(false)
    this.consume(')')
    const body = this.parseStatement()
    return { type: 'for', init, condition, update, body }
  }

  private parseIf(): JavaStatement {
    this.consume('if')
    this.consume('(')
    const condition = this.parseExpression()
    this.consume(')')
    const consequent = this.parseStatement()
    const alternate = this.matches('else') ? (this.consume('else'), this.parseStatement()) : null
    return { type: 'if', condition, consequent, alternate }
  }

  private parseDeclaration(withSemicolon: boolean): Extract<JavaStatement, { type: 'declaration' }> {
    const start = this.consume('int')
    let valueType: 'int' | 'int[]' = 'int'
    if (this.matches('[')) {
      this.consume('[')
      this.consume(']')
      valueType = 'int[]'
    }
    const name = this.expectIdentifier().value
    let init: JavaExpression | number[] | null = null
    if (this.matches('=')) {
      this.consume('=')
      init = valueType === 'int[]' && this.matches('{') ? this.parseArrayLiteral() : this.parseExpression()
    }
    if (withSemicolon) this.consume(';')
    return { type: 'declaration', name, valueType, init, line: start.line, column: start.column }
  }

  private parseSimpleStatement(withSemicolon: boolean): Extract<JavaStatement, { type: 'assignment' | 'increment' }> {
    const target = this.parseLValue()
    if (this.matches('++') || this.matches('--')) {
      const delta = this.consume().value === '++' ? 1 : -1
      if (withSemicolon) this.consume(';')
      return { type: 'increment', target, delta }
    }
    const operator = this.current().value
    if (!['=', '+=', '-='].includes(operator)) {
      fail('unsupported', '当前子集只支持变量赋值、数组赋值和自增。', this.current())
    }
    this.consume()
    const value = this.parseExpression()
    if (withSemicolon) this.consume(';')
    return { type: 'assignment', target, operator: operator as '=' | '+=' | '-=', value }
  }

  private parseLValue(): JavaLValue {
    const token = this.expectIdentifier()
    const base: JavaExpression = { type: 'variable', name: token.value }
    if (this.matches('[')) {
      this.consume('[')
      const index = this.parseExpression()
      this.consume(']')
      return { type: 'array-access', array: base, index, line: token.line, column: token.column }
    }
    return { type: 'variable', name: token.value, line: token.line, column: token.column }
  }

  private parseArrayLiteral(): number[] {
    this.consume('{')
    const values: number[] = []
    while (!this.matches('}')) {
      const token = this.consume()
      if (!/^\d+$/.test(token.value)) fail('unsupported', '数组初始值目前只支持整数。', token)
      values.push(Number(token.value))
      if (!this.matches('}')) this.consume(',')
    }
    this.consume('}')
    return values
  }

  private parseExpression(minPrecedence = 0): JavaExpression {
    let left = this.parseUnary()
    while (true) {
      const operator = this.current().value
      const precedence = BINARY_PRECEDENCE[operator]
      if (precedence === undefined || precedence < minPrecedence) break
      this.consume()
      const right = this.parseExpression(precedence + 1)
      left = { type: 'binary', operator, left, right }
    }
    return left
  }

  private parseUnary(): JavaExpression {
    if (['!', '-', '+'].includes(this.current().value)) {
      const operator = this.consume().value as '!' | '-' | '+'
      return { type: 'unary', operator, operand: this.parseUnary() }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): JavaExpression {
    let expression = this.parsePrimary()
    while (true) {
      if (this.matches('[')) {
        this.consume('[')
        const index = this.parseExpression()
        this.consume(']')
        expression = { type: 'array-access', array: expression, index }
        continue
      }
      if (this.matches('.')) {
        this.consume('.')
        const member = this.expectIdentifier('属性名').value
        if (member !== 'length') fail('unsupported', `暂不支持“${member}”属性或方法。`, this.current())
        expression = { type: 'length', array: expression }
        continue
      }
      break
    }
    return expression
  }

  private parsePrimary(): JavaExpression {
    const token = this.consume()
    if (/^\d+$/.test(token.value)) return { type: 'number', value: Number(token.value) }
    if (token.value === 'true' || token.value === 'false') return { type: 'boolean', value: token.value === 'true' }
    if (token.value === '(') {
      const expression = this.parseExpression()
      this.consume(')')
      return expression
    }
    if (/^[A-Za-z_]\w*$/.test(token.value) && !KEYWORDS.has(token.value)) {
      return { type: 'variable', name: token.value }
    }
    return fail('syntax', `无法理解“${token.value}”。`, token)
  }
}

export const parseJavaSubset = (source: string): JavaProgram => new JavaParser(source).parse()

class JavaExecutionError extends Error {
  readonly diagnostic: JavaDiagnostic

  constructor(diagnostic: JavaDiagnostic) {
    super(diagnostic.message)
    this.diagnostic = diagnostic
  }
}

type RuntimeValue = number | boolean | number[]

interface RuntimeState {
  variables: Map<string, RuntimeValue>
  steps: number
  startedAt: number
  maxSteps: number
  maxMilliseconds: number
}

const runtimeFail = (message: string, line = 1, column = 1): never => {
  throw new JavaExecutionError({ kind: 'runtime', message, line, column })
}

const touch = (state: RuntimeState, line = 1, column = 1) => {
  state.steps += 1
  if (state.steps > state.maxSteps) {
    throw new JavaExecutionError({ kind: 'timeout', message: '运行步数超过限制，代码可能陷入了无限循环。', line, column })
  }
  if (performance.now() - state.startedAt > state.maxMilliseconds) {
    throw new JavaExecutionError({ kind: 'timeout', message: '运行时间超过限制，代码可能陷入了无限循环。', line, column })
  }
}

const asNumber = (value: RuntimeValue, line: number, column: number): number => {
  if (typeof value !== 'number') return runtimeFail('这里需要一个整数。', line, column)
  return value
}

const asBoolean = (value: RuntimeValue, line: number, column: number): boolean => {
  if (typeof value !== 'boolean') return runtimeFail('这里需要一个布尔条件。', line, column)
  return value
}

const asArray = (value: RuntimeValue, line: number, column: number): number[] => {
  if (!Array.isArray(value)) return runtimeFail('这里需要一个整数数组。', line, column)
  return value
}

const readVariable = (state: RuntimeState, name: string, line: number, column: number): RuntimeValue => {
  const value = state.variables.get(name)
  if (value === undefined) return runtimeFail(`变量“${name}”还没有声明。`, line, column)
  return value
}

const readExpression = (expression: JavaExpression, state: RuntimeState): RuntimeValue => {
  switch (expression.type) {
    case 'number':
    case 'boolean':
      return expression.value
    case 'variable':
      return readVariable(state, expression.name, 1, 1)
    case 'length': {
      const array = asArray(readExpression(expression.array, state), 1, 1)
      return array.length
    }
    case 'array-access': {
      const array = asArray(readExpression(expression.array, state), 1, 1)
      const index = asNumber(readExpression(expression.index, state), 1, 1)
      if (!Number.isInteger(index) || index < 0 || index >= array.length) runtimeFail(`数组下标 ${index} 越过了货位范围。`)
      return array[index]
    }
    case 'unary': {
      const value = readExpression(expression.operand, state)
      if (expression.operator === '!') return !asBoolean(value, 1, 1)
      const number = asNumber(value, 1, 1)
      return expression.operator === '-' ? -number : number
    }
    case 'binary': {
      const left = readExpression(expression.left, state)
      if (expression.operator === '&&' && !asBoolean(left, 1, 1)) return false
      if (expression.operator === '||' && asBoolean(left, 1, 1)) return true
      const right = readExpression(expression.right, state)
      switch (expression.operator) {
        case '&&': return asBoolean(left, 1, 1) && asBoolean(right, 1, 1)
        case '||': return asBoolean(left, 1, 1) || asBoolean(right, 1, 1)
        case '==': return left === right
        case '!=': return left !== right
        case '<': return asNumber(left, 1, 1) < asNumber(right, 1, 1)
        case '<=': return asNumber(left, 1, 1) <= asNumber(right, 1, 1)
        case '>': return asNumber(left, 1, 1) > asNumber(right, 1, 1)
        case '>=': return asNumber(left, 1, 1) >= asNumber(right, 1, 1)
        case '+': return asNumber(left, 1, 1) + asNumber(right, 1, 1)
        case '-': return asNumber(left, 1, 1) - asNumber(right, 1, 1)
        case '*': return asNumber(left, 1, 1) * asNumber(right, 1, 1)
        case '/': {
          const divisor = asNumber(right, 1, 1)
          if (divisor === 0) runtimeFail('不能除以 0。')
          return Math.trunc(asNumber(left, 1, 1) / divisor)
        }
        case '%': return asNumber(left, 1, 1) % asNumber(right, 1, 1)
        default: return runtimeFail(`暂不支持运算符“${expression.operator}”。`)
      }
    }
  }
}

const writeLValue = (target: JavaLValue, value: RuntimeValue, state: RuntimeState) => {
  if (target.type === 'variable') {
    if (typeof value === 'boolean' || Array.isArray(value)) runtimeFail('当前变量只能保存整数。', target.line, target.column)
    state.variables.set(target.name, value)
    return
  }
  const array = asArray(readExpression(target.array, state), target.line, target.column)
  const index = asNumber(readExpression(target.index, state), target.line, target.column)
  if (!Number.isInteger(index) || index < 0 || index >= array.length) runtimeFail(`数组下标 ${index} 越过了货位范围。`, target.line, target.column)
  array[index] = asNumber(value, target.line, target.column)
}

const executeStatement = (statement: JavaStatement, state: RuntimeState): void => {
  touch(state, 'line' in statement ? statement.line : 1, 'column' in statement ? statement.column : 1)
  switch (statement.type) {
    case 'block':
      statement.statements.forEach((child) => executeStatement(child, state))
      return
    case 'declaration': {
      if (statement.name === 'nums' && statement.valueType === 'int[]') return
      const value = statement.init === null
        ? statement.valueType === 'int[]' ? [] : 0
        : Array.isArray(statement.init) ? [...statement.init] : readExpression(statement.init, state)
      state.variables.set(statement.name, value)
      return
    }
    case 'assignment': {
      const right = readExpression(statement.value, state)
      if (statement.operator === '=') {
        writeLValue(statement.target, right, state)
        return
      }
      const previous = statement.target.type === 'variable'
        ? readVariable(state, statement.target.name, statement.target.line, statement.target.column)
        : readExpression({ type: 'array-access', array: statement.target.array, index: statement.target.index }, state)
      const next = statement.operator === '+='
        ? asNumber(previous, statement.target.line, statement.target.column) + asNumber(right, statement.target.line, statement.target.column)
        : asNumber(previous, statement.target.line, statement.target.column) - asNumber(right, statement.target.line, statement.target.column)
      writeLValue(statement.target, next, state)
      return
    }
    case 'increment': {
      const previous = statement.target.type === 'variable'
        ? readVariable(state, statement.target.name, statement.target.line, statement.target.column)
        : readExpression({ type: 'array-access', array: statement.target.array, index: statement.target.index }, state)
      writeLValue(statement.target, asNumber(previous, statement.target.line, statement.target.column) + statement.delta, state)
      return
    }
    case 'if':
      if (asBoolean(readExpression(statement.condition, state), 1, 1)) executeStatement(statement.consequent, state)
      else if (statement.alternate) executeStatement(statement.alternate, state)
      return
    case 'for':
      if (statement.init) executeStatement(statement.init, state)
      while (asBoolean(readExpression(statement.condition, state), 1, 1)) {
        executeStatement(statement.body, state)
        executeStatement(statement.update, state)
      }
      return
  }
}

const expectedValues = (values: number[]) => {
  const cargo = values.filter((value) => value !== 0)
  return [...cargo, ...Array(values.length - cargo.length).fill(0)]
}

export const runJavaSubset = (
  source: string,
  input: number[],
  expected: number[] = expectedValues(input),
  limits = { maxSteps: 10_000, maxMilliseconds: 80 },
): JavaRunResult => {
  let program: JavaProgram
  try {
    program = parseJavaSubset(source)
  } catch (error) {
    const diagnostic = error instanceof JavaSubsetError
      ? error.diagnostic
      : { kind: 'syntax' as const, message: '代码无法解析。', line: 1, column: 1 }
    return { ok: false, kind: diagnostic.kind, message: diagnostic.message, diagnostic, steps: 0 }
  }

  const state: RuntimeState = {
    variables: new Map([['nums', [...input]]]),
    steps: 0,
    startedAt: performance.now(),
    maxSteps: limits.maxSteps,
    maxMilliseconds: limits.maxMilliseconds,
  }

  try {
    program.statements.forEach((statement) => executeStatement(statement, state))
  } catch (error) {
    const diagnostic = error instanceof JavaExecutionError
      ? error.diagnostic
      : { kind: 'runtime' as const, message: '代码运行失败。', line: 1, column: 1 }
    return { ok: false, kind: diagnostic.kind, message: diagnostic.message, diagnostic, steps: state.steps }
  }

  const values = state.variables.get('nums')
  if (!Array.isArray(values)) {
    const diagnostic: JavaDiagnostic = { kind: 'runtime', message: '代码没有保留可验证的 nums 数组。', line: 1, column: 1 }
    return { ok: false, kind: diagnostic.kind, message: diagnostic.message, diagnostic, steps: state.steps }
  }
  const matches = values.length === expected.length && values.every((value, index) => value === expected[index])
  if (!matches) {
    const diagnostic: JavaDiagnostic = { kind: 'output', message: '代码运行完成，但货箱结果与目标不符。', line: 1, column: 1 }
    return { ok: false, kind: diagnostic.kind, message: diagnostic.message, values: [...values], expected, diagnostic, steps: state.steps }
  }
  return { ok: true, kind: 'success', message: '代码通过当前用例。', values: [...values], expected, steps: state.steps }
}
