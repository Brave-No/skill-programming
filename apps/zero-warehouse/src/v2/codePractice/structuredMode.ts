import { analyzeMoveZeroesProgram, type MoveZeroesSemanticChecks } from './moveZeroesSemantics'
import { parseJavaSubset, type JavaDiagnostic } from './javaSubset'

export const STRUCTURED_SLOT_IDS = [
  'preparation',
  'loop-init',
  'loop-condition',
  'loop-update',
  'occupied-condition',
  'swap',
  'slow-update',
] as const

export type StructuredSlotId = typeof STRUCTURED_SLOT_IDS[number]

export interface StructuredDraft {
  preparation: string
  'loop-init': string
  'loop-condition': string
  'loop-update': string
  'occupied-condition': string
  swap: string
  'slow-update': string
}

export interface StructuredSlotDefinition {
  id: StructuredSlotId
  label: string
  shortLabel: string
  placeholder: string
  multiline: boolean
}

export type StructuredDepth = 0 | 1 | 2

export type StructuredLineSegment =
  | { kind: 'fixed'; value: string }
  | { kind: 'slot'; slotId: StructuredSlotId }

export type StructuredScaffoldNode =
  | { id: string; kind: 'blank' }
  | {
    id: string
    kind: 'statement-group'
    slotId: StructuredSlotId
    depth: StructuredDepth
    lineCount: number
    statementTerminator: string
  }
  | {
    id: string
    kind: 'line'
    depth: StructuredDepth
    segments: StructuredLineSegment[]
  }
  | {
    id: string
    kind: 'fixed-line'
    depth: StructuredDepth
    value: string
    lockedLabel: string
  }

export interface StructuredScaffold {
  methodOpen: string
  methodClose: string
  body: StructuredScaffoldNode[]
}

export interface StructuredSlotRange {
  lineStart: number
  columnStart: number
  lineEnd: number
  columnEnd: number
}

export interface StructuredComposition {
  source: string
  ranges: Record<StructuredSlotId, StructuredSlotRange>
}

export interface StructuredSlotIssue {
  kind: 'required' | 'syntax' | 'semantic'
  slotId: StructuredSlotId
  message: string
  diagnostic?: JavaDiagnostic
}

export type StructuredValidation =
  | { kind: 'valid' }
  | { kind: 'invalid'; issue: StructuredSlotIssue }

export const STRUCTURED_SLOT_DEFINITIONS: StructuredSlotDefinition[] = [
  {
    id: 'preparation',
    label: '准备变量',
    shortLabel: '准备',
    placeholder: 'int len = nums.length;\nint fast = 0;\nint slow = 0;',
    multiline: true,
  },
  { id: 'loop-init', label: '循环初始化', shortLabel: '从哪里开始', placeholder: 'fast = 0', multiline: false },
  { id: 'loop-condition', label: '循环条件', shortLabel: '什么时候继续', placeholder: 'fast < len', multiline: false },
  { id: 'loop-update', label: '循环前进', shortLabel: '每轮怎么走', placeholder: 'fast++', multiline: false },
  { id: 'occupied-condition', label: '有货判断', shortLabel: '什么情况搬货', placeholder: 'nums[fast] != 0', multiline: false },
  {
    id: 'swap',
    label: '交换货物',
    shortLabel: '怎么交换',
    placeholder: 'int tmp = nums[slow];\nnums[slow] = nums[fast];\nnums[fast] = tmp;',
    multiline: true,
  },
  { id: 'slow-update', label: '装载手前进', shortLabel: '装载位怎么走', placeholder: 'slow++', multiline: false },
]

export const STRUCTURED_SCAFFOLD: StructuredScaffold = {
  methodOpen: 'void moveZeroes(int[] nums) {',
  methodClose: '}',
  body: [
    {
      id: 'preparation',
      kind: 'statement-group',
      slotId: 'preparation',
      depth: 0,
      lineCount: 3,
      statementTerminator: ';',
    },
    { id: 'preparation-gap', kind: 'blank' },
    {
      id: 'loop',
      kind: 'line',
      depth: 0,
      segments: [
        { kind: 'fixed', value: 'for (' },
        { kind: 'slot', slotId: 'loop-init' },
        { kind: 'fixed', value: '; ' },
        { kind: 'slot', slotId: 'loop-condition' },
        { kind: 'fixed', value: '; ' },
        { kind: 'slot', slotId: 'loop-update' },
        { kind: 'fixed', value: ') {' },
      ],
    },
    {
      id: 'condition',
      kind: 'line',
      depth: 1,
      segments: [
        { kind: 'fixed', value: 'if (' },
        { kind: 'slot', slotId: 'occupied-condition' },
        { kind: 'fixed', value: ') {' },
      ],
    },
    {
      id: 'swap',
      kind: 'statement-group',
      slotId: 'swap',
      depth: 2,
      lineCount: 3,
      statementTerminator: ';',
    },
    {
      id: 'update',
      kind: 'line',
      depth: 2,
      segments: [
        { kind: 'slot', slotId: 'slow-update' },
        { kind: 'fixed', value: ';' },
      ],
    },
    {
      id: 'close-condition',
      kind: 'fixed-line',
      depth: 1,
      value: '}',
      lockedLabel: '固定结束条件判断',
    },
    {
      id: 'close-loop',
      kind: 'fixed-line',
      depth: 0,
      value: '}',
      lockedLabel: '固定结束逐个遍历',
    },
  ],
}

export const createEmptyStructuredDraft = (): StructuredDraft => ({
  preparation: '',
  'loop-init': '',
  'loop-condition': '',
  'loop-update': '',
  'occupied-condition': '',
  swap: '',
  'slow-update': '',
})

export const restoreStructuredDraft = (stored: string | null): StructuredDraft => {
  if (!stored) return createEmptyStructuredDraft()
  try {
    const value = JSON.parse(stored) as Partial<Record<StructuredSlotId, unknown>>
    return Object.fromEntries(
      STRUCTURED_SLOT_IDS.map((slotId) => [slotId, typeof value[slotId] === 'string' ? value[slotId] : '']),
    ) as unknown as StructuredDraft
  } catch {
    return createEmptyStructuredDraft()
  }
}

const normalizedStatementLines = (value: string, terminator: string, lineCount: number) => {
  const lines = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, lineCount)
    .map((line) => `${line.replace(/;+\s*$/, '')}${terminator}`)
  return lines.length ? lines : [terminator]
}

export const composeStructuredBody = (
  draft: StructuredDraft,
  scaffold: StructuredScaffold = STRUCTURED_SCAFFOLD,
): StructuredComposition => {
  const lines: string[] = []
  const ranges = {} as Record<StructuredSlotId, StructuredSlotRange>

  for (const node of scaffold.body) {
    if (node.kind === 'blank') {
      lines.push('')
      continue
    }
    const indentation = '  '.repeat(node.depth)
    if (node.kind === 'fixed-line') {
      lines.push(`${indentation}${node.value}`)
      continue
    }
    if (node.kind === 'statement-group') {
      const slotLines = normalizedStatementLines(
        draft[node.slotId],
        node.statementTerminator,
        node.lineCount,
      )
      const lineStart = lines.length + 1
      slotLines.forEach((line) => lines.push(`${indentation}${line}`))
      ranges[node.slotId] = {
        lineStart,
        columnStart: indentation.length + 1,
        lineEnd: lines.length,
        columnEnd: indentation.length + Math.max(slotLines.at(-1)?.length ?? 0, 1),
      }
      continue
    }

    const lineNumber = lines.length + 1
    let line = indentation
    for (const segment of node.segments) {
      if (segment.kind === 'fixed') {
        line += segment.value
        continue
      }
      const value = draft[segment.slotId].trim()
      const columnStart = line.length + 1
      line += value
      ranges[segment.slotId] = {
        lineStart: lineNumber,
        columnStart,
        lineEnd: lineNumber,
        columnEnd: columnStart + Math.max(value.length, 1) - 1,
      }
    }
    lines.push(line)
  }

  return { source: lines.join('\n'), ranges }
}

const requiredMessages: Record<StructuredSlotId, string> = {
  preparation: '先写准备变量，让扫描手和装载手都有可以引用的位置。',
  'loop-init': '填写扫描从哪里开始。',
  'loop-condition': '填写扫描在什么条件下继续。',
  'loop-update': '填写每轮结束后扫描手如何前进。',
  'occupied-condition': '填写什么情况下货位算有货。',
  swap: '写出交换货物需要的语句。',
  'slow-update': '填写装载完成后装载手如何前进。',
}

const semanticMessages: Array<{
  slotId: StructuredSlotId
  check: keyof MoveZeroesSemanticChecks
  message: string
}> = [
  { slotId: 'preparation', check: 'preparation', message: '准备区需要把装载手使用的变量初始化为 0。' },
  { slotId: 'loop-init', check: 'loopInit', message: '循环初始化需要让扫描变量从 0 开始。' },
  { slotId: 'loop-condition', check: 'loopCondition', message: '循环条件需要让同一个扫描变量走到 nums.length 或它的长度别名之前。' },
  { slotId: 'loop-update', check: 'loopUpdate', message: '每轮结束后需要让同一个扫描变量前进一步。' },
  { slotId: 'occupied-condition', check: 'occupiedCondition', message: '判断条件需要检查扫描位置的 nums 元素不等于 0。' },
  { slotId: 'swap', check: 'swap', message: '交换区需要用临时变量完整交换扫描位与装载位的货物。' },
  { slotId: 'slow-update', check: 'slowUpdate', message: '交换完成后需要让同一个装载变量前进一步。' },
]

const diagnosticFrom = (error: unknown): JavaDiagnostic => {
  if (error && typeof error === 'object' && 'diagnostic' in error) {
    const diagnostic = (error as { diagnostic?: JavaDiagnostic }).diagnostic
    if (diagnostic) return diagnostic
  }
  return { kind: 'syntax', message: '代码无法解析。', line: 1, column: 1 }
}

export const slotForDiagnostic = (
  composition: StructuredComposition,
  diagnostic: Pick<JavaDiagnostic, 'line' | 'column'>,
): StructuredSlotId => {
  const entries = STRUCTURED_SLOT_IDS
    .map((slotId) => ({ slotId, range: composition.ranges[slotId] }))
    .filter((entry): entry is { slotId: StructuredSlotId; range: StructuredSlotRange } => Boolean(entry.range))
  const exact = entries.find(({ range }) => (
    diagnostic.line >= range.lineStart
    && diagnostic.line <= range.lineEnd
    && (
      range.lineStart !== range.lineEnd
      || (diagnostic.column >= range.columnStart && diagnostic.column <= range.columnEnd + 1)
    )
  ))
  if (exact) return exact.slotId

  const sameLine = entries.filter(({ range }) => diagnostic.line >= range.lineStart && diagnostic.line <= range.lineEnd)
  if (sameLine.length) {
    return sameLine.sort((left, right) => {
      const leftDistance = Math.min(
        Math.abs(diagnostic.column - left.range.columnStart),
        Math.abs(diagnostic.column - left.range.columnEnd),
      )
      const rightDistance = Math.min(
        Math.abs(diagnostic.column - right.range.columnStart),
        Math.abs(diagnostic.column - right.range.columnEnd),
      )
      return leftDistance - rightDistance
    })[0].slotId
  }

  return entries.sort((left, right) => {
    const leftDistance = Math.min(
      Math.abs(diagnostic.line - left.range.lineStart),
      Math.abs(diagnostic.line - left.range.lineEnd),
    )
    const rightDistance = Math.min(
      Math.abs(diagnostic.line - right.range.lineStart),
      Math.abs(diagnostic.line - right.range.lineEnd),
    )
    return leftDistance - rightDistance
  })[0]?.slotId ?? 'preparation'
}

interface StructuredValidationOptions {
  normalizeSource?: (source: string) => string
  requiredSlotIds?: StructuredSlotId[]
  issueSlotAliases?: Partial<Record<StructuredSlotId, StructuredSlotId>>
}

export const validateStructuredDraft = (
  draft: StructuredDraft,
  composition: StructuredComposition = composeStructuredBody(draft),
  options: StructuredValidationOptions = {},
): StructuredValidation => {
  const requiredSlotIds = options.requiredSlotIds ?? [...STRUCTURED_SLOT_IDS]
  const missingSlot = requiredSlotIds.find((slotId) => !draft[slotId].trim())
  if (missingSlot) {
    return {
      kind: 'invalid',
      issue: { kind: 'required', slotId: missingSlot, message: requiredMessages[missingSlot] },
    }
  }

  let program
  try {
    program = parseJavaSubset(options.normalizeSource?.(composition.source) ?? composition.source)
  } catch (error) {
    const diagnostic = diagnosticFrom(error)
    return {
      kind: 'invalid',
      issue: {
        kind: 'syntax',
        slotId: slotForDiagnostic(composition, diagnostic),
        message: diagnostic.message,
        diagnostic,
      },
    }
  }

  const analysis = analyzeMoveZeroesProgram(program)
  const failedCheck = semanticMessages.find(({ check }) => !analysis.checks[check])
  if (failedCheck) {
    return {
      kind: 'invalid',
      issue: {
        kind: 'semantic',
        slotId: options.issueSlotAliases?.[failedCheck.slotId] ?? failedCheck.slotId,
        message: failedCheck.message,
      },
    }
  }

  return { kind: 'valid' }
}
