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
  value?: number
  expected?: number
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
  | { type: 'call'; callee: string; args: JavaExpression[] }
  | { type: 'unary'; operator: '!' | '-' | '+'; operand: JavaExpression }
  | { type: 'binary'; operator: string; left: JavaExpression; right: JavaExpression }
  | {
      type: 'conditional'
      condition: JavaExpression
      consequent: JavaExpression
      alternate: JavaExpression
    }

export type JavaLValue =
  | { type: 'variable'; name: string; line: number; column: number }
  | {
      type: 'array-access'
      array: JavaExpression
      index: JavaExpression
      line: number
      column: number
    }

export type JavaStatement =
  | { type: 'block'; statements: JavaStatement[]; line: number; column: number }
  | {
      type: 'declaration'
      name: string
      init: JavaExpression | null
      line: number
      column: number
    }
  | {
      type: 'assignment'
      target: JavaLValue
      operator: '=' | '+=' | '-='
      value: JavaExpression
      line: number
      column: number
    }
  | {
      type: 'increment'
      target: JavaLValue
      delta: 1 | -1
      line: number
      column: number
    }
  | {
      type: 'if'
      condition: JavaExpression
      consequent: JavaStatement
      alternate: JavaStatement | null
      line: number
      column: number
    }
  | {
      type: 'while'
      condition: JavaExpression
      body: JavaStatement
      line: number
      column: number
    }
  | { type: 'return'; value: JavaExpression; line: number; column: number }

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

const KEYWORDS = new Set([
  'int',
  'while',
  'if',
  'else',
  'return',
  'true',
  'false',
])

const TWO_CHARACTER_OPERATORS = [
  '++',
  '--',
  '+=',
  '-=',
  '<=',
  '>=',
  '==',
  '!=',
  '&&',
  '||',
]

const SINGLE_CHARACTER_OPERATORS = new Set([
  '{',
  '}',
  '(',
  ')',
  '[',
  ']',
  ';',
  '.',
  '=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '<',
  '>',
  ',',
  '?',
  ':',
])

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
      tokens.push({ value, ...start })
      continue
    }

    if (/\d/.test(character)) {
      let value = ''
      while (index < source.length && /\d/.test(source[index])) {
        value += source[index]
        advance()
      }
      tokens.push({ value, ...start })
      continue
    }

    const twoCharacter = source.slice(index, index + 2)
    if (TWO_CHARACTER_OPERATORS.includes(twoCharacter)) {
      tokens.push({ value: twoCharacter, ...start })
      advance()
      advance()
      continue
    }

    if (SINGLE_CHARACTER_OPERATORS.has(character)) {
      tokens.push({ value: character, ...start })
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
    if (this.matches('while')) return this.parseWhile()
    if (this.matches('if')) return this.parseIf()
    if (this.matches('return')) return this.parseReturn()
    if (this.matches('int')) return this.parseDeclaration()
    if (this.matches(';')) {
      const token = this.consume(';')
      return { type: 'block', statements: [], line: token.line, column: token.column }
    }
    if (['for', 'do', 'switch', 'class', 'public', 'private', 'static', 'void', 'new'].includes(this.current().value)) {
      fail(
        'unsupported',
        `暂不支持“${this.current().value}”语法；这道题当前支持 int、while、if/else、return、数组与 Math.max。`,
        this.current(),
      )
    }
    if (/^[A-Za-z_]\w*$/.test(this.current().value)) return this.parseSimpleStatement()
    return fail('syntax', '这里不是一个可执行的 Java 语句。', this.current())
  }

  private parseBlock(): JavaStatement {
    const start = this.consume('{')
    const statements: JavaStatement[] = []
    while (!this.matches('}')) {
      if (this.matches('<eof>')) fail('syntax', '代码块缺少右大括号。', this.current())
      statements.push(this.parseStatement())
    }
    this.consume('}')
    return { type: 'block', statements, line: start.line, column: start.column }
  }

  private parseWhile(): JavaStatement {
    const start = this.consume('while')
    this.consume('(')
    const condition = this.parseExpression()
    this.consume(')')
    const body = this.parseStatement()
    return { type: 'while', condition, body, line: start.line, column: start.column }
  }

  private parseIf(): JavaStatement {
    const start = this.consume('if')
    this.consume('(')
    const condition = this.parseExpression()
    this.consume(')')
    const consequent = this.parseStatement()
    const alternate = this.matches('else')
      ? (this.consume('else'), this.parseStatement())
      : null
    return { type: 'if', condition, consequent, alternate, line: start.line, column: start.column }
  }

  private parseReturn(): JavaStatement {
    const start = this.consume('return')
    const value = this.parseExpression()
    this.consume(';')
    return { type: 'return', value, line: start.line, column: start.column }
  }

  private parseDeclaration(): JavaStatement {
    const start = this.consume('int')
    if (this.matches('[')) {
      fail('unsupported', '方法体内暂不支持新建数组；直接使用入参 height。', this.current())
    }
    const identifier = this.expectIdentifier()
    const init = this.matches('=')
      ? (this.consume('='), this.parseExpression())
      : null
    this.consume(';')
    return {
      type: 'declaration',
      name: identifier.value,
      init,
      line: start.line,
      column: start.column,
    }
  }

  private parseSimpleStatement(): JavaStatement {
    const start = this.current()
    const expression = this.parsePostfix()
    const target = this.toLValue(expression, start)
    if (this.matches('++') || this.matches('--')) {
      const operator = this.consume().value
      this.consume(';')
      return {
        type: 'increment',
        target,
        delta: operator === '++' ? 1 : -1,
        line: start.line,
        column: start.column,
      }
    }
    if (this.matches('=') || this.matches('+=') || this.matches('-=')) {
      const operator = this.consume().value as '=' | '+=' | '-='
      const value = this.parseExpression()
      this.consume(';')
      return { type: 'assignment', target, operator, value, line: start.line, column: start.column }
    }
    return fail('syntax', '这条语句需要赋值、累加或自增/自减操作。', this.current())
  }

  private toLValue(expression: JavaExpression, token: JavaToken): JavaLValue {
    if (expression.type === 'variable') {
      return { ...expression, line: token.line, column: token.column }
    }
    if (expression.type === 'array-access') {
      return { ...expression, line: token.line, column: token.column }
    }
    return fail('syntax', '等号左边需要变量或数组位置。', token)
  }

  private parseExpression(minimumPrecedence = 0): JavaExpression {
    let left = this.parseUnary()
    while (true) {
      const operator = this.current().value
      const precedence = BINARY_PRECEDENCE[operator]
      if (precedence === undefined || precedence < minimumPrecedence) break
      this.consume()
      const right = this.parseExpression(precedence + 1)
      left = { type: 'binary', operator, left, right }
    }

    if (minimumPrecedence === 0 && this.matches('?')) {
      this.consume('?')
      const consequent = this.parseExpression()
      this.consume(':')
      const alternate = this.parseExpression()
      left = { type: 'conditional', condition: left, consequent, alternate }
    }
    return left
  }

  private parseUnary(): JavaExpression {
    if (this.matches('!') || this.matches('-') || this.matches('+')) {
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
        const property = this.expectIdentifier('属性或方法名').value
        if (property === 'length' && !this.matches('(')) {
          expression = { type: 'length', array: expression }
          continue
        }
        if (!this.matches('(')) {
          fail('unsupported', `暂不支持属性“${property}”。`, this.current())
        }
        const owner = expression.type === 'variable' ? expression.name : ''
        this.consume('(')
        const args: JavaExpression[] = []
        if (!this.matches(')')) {
          do {
            args.push(this.parseExpression())
            if (!this.matches(',')) break
            this.consume(',')
          } while (!this.matches(')'))
        }
        this.consume(')')
        expression = { type: 'call', callee: `${owner}.${property}`, args }
        continue
      }
      break
    }
    return expression
  }

  private parsePrimary(): JavaExpression {
    const token = this.current()
    if (/^\d+$/.test(token.value)) {
      this.consume()
      return { type: 'number', value: Number(token.value) }
    }
    if (token.value === 'true' || token.value === 'false') {
      this.consume()
      return { type: 'boolean', value: token.value === 'true' }
    }
    if (/^[A-Za-z_]\w*$/.test(token.value) && !KEYWORDS.has(token.value)) {
      this.consume()
      return { type: 'variable', name: token.value }
    }
    if (this.matches('(')) {
      this.consume('(')
      const expression = this.parseExpression()
      this.consume(')')
      return expression
    }
    return fail('syntax', '这里需要一个数值、变量或数组位置。', token)
  }
}

export const parseJavaSubset = (source: string) => new JavaParser(source).parse()

type RuntimeValue = number | boolean | number[]

class ReturnSignal {
  constructor(readonly value: RuntimeValue) {}
}

class JavaRuntime {
  private readonly environment = new Map<string, RuntimeValue>()
  private steps = 0
  private readonly stepLimit: number

  constructor(height: number[], stepLimit = 20_000) {
    this.environment.set('height', [...height])
    this.stepLimit = stepLimit
  }

  get stepCount() {
    return this.steps
  }

  private tick(statement: Pick<JavaStatement, 'line' | 'column'>) {
    this.steps += 1
    if (this.steps > this.stepLimit) {
      fail('timeout', '执行步数超过限制，请检查 while 条件和指针移动。', statement)
    }
  }

  private number(value: RuntimeValue, token: Pick<JavaToken, 'line' | 'column'>): number {
    if (typeof value !== 'number') fail('runtime', '这里需要整数值。', token)
    return value as number
  }

  private boolean(value: RuntimeValue): boolean {
    return typeof value === 'boolean' ? value : this.number(value, { line: 1, column: 1 }) !== 0
  }

  private array(value: RuntimeValue, token: Pick<JavaToken, 'line' | 'column'>): number[] {
    if (!Array.isArray(value)) fail('runtime', '这里需要数组。', token)
    return value as number[]
  }

  private evaluate(expression: JavaExpression): RuntimeValue {
    switch (expression.type) {
      case 'number':
      case 'boolean':
        return expression.value
      case 'variable': {
        const value = this.environment.get(expression.name)
        if (value === undefined) {
          fail('runtime', `变量“${expression.name}”还没有声明。`, { line: 1, column: 1 })
        }
        return value as RuntimeValue
      }
      case 'length': {
        const array = this.array(this.evaluate(expression.array), { line: 1, column: 1 })
        return array.length
      }
      case 'array-access': {
        const array = this.array(this.evaluate(expression.array), { line: 1, column: 1 })
        const index = this.number(this.evaluate(expression.index), { line: 1, column: 1 })
        if (!Number.isInteger(index) || index < 0 || index >= array.length) {
          fail('runtime', `数组位置 ${index} 越界了。`, { line: 1, column: 1 })
        }
        return array[index]
      }
      case 'call': {
        if (expression.callee !== 'Math.max' || expression.args.length !== 2) {
          fail('unsupported', '当前只支持两个整数参数的 Math.max。', { line: 1, column: 1 })
        }
        return Math.max(
          this.number(this.evaluate(expression.args[0]), { line: 1, column: 1 }),
          this.number(this.evaluate(expression.args[1]), { line: 1, column: 1 }),
        )
      }
      case 'unary': {
        const operand = this.evaluate(expression.operand)
        if (expression.operator === '!') return !this.boolean(operand)
        const value = this.number(operand, { line: 1, column: 1 })
        return expression.operator === '-' ? -value : value
      }
      case 'conditional':
        return this.boolean(this.evaluate(expression.condition))
          ? this.evaluate(expression.consequent)
          : this.evaluate(expression.alternate)
      case 'binary': {
        if (expression.operator === '&&') {
          return this.boolean(this.evaluate(expression.left)) && this.boolean(this.evaluate(expression.right))
        }
        if (expression.operator === '||') {
          return this.boolean(this.evaluate(expression.left)) || this.boolean(this.evaluate(expression.right))
        }
        const left = this.number(this.evaluate(expression.left), { line: 1, column: 1 })
        const right = this.number(this.evaluate(expression.right), { line: 1, column: 1 })
        switch (expression.operator) {
          case '+': return left + right
          case '-': return left - right
          case '*': return left * right
          case '/':
            if (right === 0) fail('runtime', '不能除以 0。', { line: 1, column: 1 })
            return Math.trunc(left / right)
          case '%':
            if (right === 0) fail('runtime', '不能对 0 取余。', { line: 1, column: 1 })
            return left % right
          case '<': return left < right
          case '<=': return left <= right
          case '>': return left > right
          case '>=': return left >= right
          case '==': return left === right
          case '!=': return left !== right
          default:
            return fail('unsupported', `暂不支持运算符“${expression.operator}”。`, { line: 1, column: 1 })
        }
      }
    }
  }

  private readTarget(target: JavaLValue): RuntimeValue {
    if (target.type === 'variable') {
      const value = this.environment.get(target.name)
      if (value === undefined) fail('runtime', `变量“${target.name}”还没有声明。`, target)
      return value as RuntimeValue
    }
    return this.evaluate(target)
  }

  private writeTarget(target: JavaLValue, value: RuntimeValue): void {
    if (target.type === 'variable') {
      if (!this.environment.has(target.name)) fail('runtime', `变量“${target.name}”还没有声明。`, target)
      this.environment.set(target.name, value)
      return
    }
    const array = this.array(this.evaluate(target.array), target)
    const index = this.number(this.evaluate(target.index), target)
    if (!Number.isInteger(index) || index < 0 || index >= array.length) {
      fail('runtime', `数组位置 ${index} 越界了。`, target)
    }
    array[index] = this.number(value, target)
  }

  private execute(statement: JavaStatement): void {
    this.tick(statement)
    switch (statement.type) {
      case 'block':
        statement.statements.forEach((child) => this.execute(child))
        return
      case 'declaration':
        if (this.environment.has(statement.name)) {
          fail('runtime', `变量“${statement.name}”已经声明过了。`, statement)
        }
        this.environment.set(statement.name, statement.init ? this.evaluate(statement.init) : 0)
        return
      case 'assignment': {
        const value = this.evaluate(statement.value)
        if (statement.operator === '=') {
          this.writeTarget(statement.target, value)
        } else {
          const current = this.number(this.readTarget(statement.target), statement)
          const delta = this.number(value, statement)
          this.writeTarget(statement.target, statement.operator === '+=' ? current + delta : current - delta)
        }
        return
      }
      case 'increment': {
        const current = this.number(this.readTarget(statement.target), statement)
        this.writeTarget(statement.target, current + statement.delta)
        return
      }
      case 'if':
        if (this.boolean(this.evaluate(statement.condition))) this.execute(statement.consequent)
        else if (statement.alternate) this.execute(statement.alternate)
        return
      case 'while':
        while (this.boolean(this.evaluate(statement.condition))) this.execute(statement.body)
        return
      case 'return':
        throw new ReturnSignal(this.evaluate(statement.value))
    }
  }

  run(program: JavaProgram) {
    try {
      program.statements.forEach((statement) => this.execute(statement))
    } catch (error) {
      if (error instanceof ReturnSignal) return error.value
      throw error
    }
    fail('runtime', '程序运行结束了，但没有 return 结果。', { line: 1, column: 1 })
  }
}

const diagnosticFrom = (error: unknown): JavaDiagnostic => {
  if (error instanceof JavaSubsetError) return error.diagnostic
  return { kind: 'runtime', message: '代码执行时遇到未知问题。', line: 1, column: 1 }
}

export const runJavaSubset = (
  source: string,
  input: number[],
  expected?: number,
): JavaRunResult => {
  let runtime: JavaRuntime | null = null
  try {
    const program = parseJavaSubset(source)
    runtime = new JavaRuntime(input)
    const value = runtime.run(program)
    if (typeof value !== 'number') {
      return {
        ok: false,
        kind: 'output',
        message: '方法需要返回整数雨水总量。',
        diagnostic: { kind: 'output', message: '返回值不是整数。', line: 1, column: 1 },
        steps: runtime.stepCount,
      }
    }
    if (expected !== undefined && value !== expected) {
      return {
        ok: false,
        kind: 'output',
        message: `当前结果是 ${value}，期望结果是 ${expected}。`,
        value,
        expected,
        steps: runtime.stepCount,
      }
    }
    return {
      ok: true,
      kind: 'success',
      message: expected === undefined ? `返回 ${value}。` : `返回 ${value}，与期望一致。`,
      value,
      expected,
      steps: runtime.stepCount,
    }
  } catch (error) {
    const diagnostic = diagnosticFrom(error)
    return {
      ok: false,
      kind: diagnostic.kind,
      message: diagnostic.message,
      diagnostic,
      steps: runtime?.stepCount ?? 0,
    }
  }
}
