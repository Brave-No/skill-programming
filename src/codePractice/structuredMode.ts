import type {
  AlgorithmChallenge,
  ChallengeSkillDefinition,
  CodePracticeDiagnostic,
  SemanticResult,
  StructuredScaffold,
  VerificationBatchBase,
} from '../challenges/types'

export type StructuredDraft = Record<string, string>

export interface StructuredSlotRange {
  lineStart: number
  lineEnd: number
  columnStart: number
  columnEnd: number
}

export interface StructuredComposition {
  source: string
  ranges: Record<string, StructuredSlotRange>
}

export interface StructuredIssue {
  kind: 'required' | 'syntax' | 'semantic'
  slotId: string
  message: string
}

export type StructuredValidation<ProgramAst> =
  | { kind: 'valid'; program: ProgramAst; semantic: SemanticResult }
  | { kind: 'invalid'; issue: StructuredIssue }

export const createEmptyStructuredDraft = (scaffold: StructuredScaffold): StructuredDraft =>
  Object.fromEntries(scaffold.slots.map((slot) => [slot.id, '']))

const normalizeSlotLines = (value: string, lineCount: number, suffix = '') => {
  const rawLines = value.replace(/\r\n?/g, '\n').split('\n').slice(0, lineCount)
  const lines = rawLines.map((line) => {
    if (!suffix || !line.trim()) return line
    return `${line.replace(/;+\s*$/, '')}${suffix}`
  })
  return lines.length ? lines : ['']
}

export const composeStructuredBody = (
  scaffold: StructuredScaffold,
  draft: StructuredDraft,
): StructuredComposition => {
  const lines: string[] = []
  const ranges: Record<string, StructuredSlotRange> = {}
  const slotById = new Map(scaffold.slots.map((slot) => [slot.id, slot]))

  for (const node of scaffold.body) {
    const indentation = '  '.repeat(node.depth)
    if (node.kind === 'fixed') {
      lines.push(`${indentation}${node.value}`)
      continue
    }
    if (node.kind === 'slot') {
      const definition = slotById.get(node.slotId)!
      const slotLines = normalizeSlotLines(
        draft[node.slotId] ?? '',
        definition.lineCount,
        node.suffix ?? '',
      )
      const lineStart = lines.length + 1
      slotLines.forEach((line) => lines.push(`${indentation}${line}`))
      ranges[node.slotId] = {
        lineStart,
        lineEnd: lines.length,
        columnStart: indentation.length + 1,
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
      const value = draft[segment.slotId] ?? ''
      const columnStart = line.length + 1
      line += value.trim()
      ranges[segment.slotId] = {
        lineStart: lineNumber,
        lineEnd: lineNumber,
        columnStart,
        columnEnd: columnStart + Math.max(value.trim().length, 1) - 1,
      }
    }
    lines.push(line)
  }

  return { source: lines.join('\n'), ranges }
}

const diagnosticFrom = (error: unknown): CodePracticeDiagnostic => {
  if (error && typeof error === 'object' && 'diagnostic' in error) {
    const diagnostic = (error as { diagnostic?: CodePracticeDiagnostic }).diagnostic
    if (diagnostic) return diagnostic
  }
  return { kind: 'syntax', message: '代码无法解析。', line: 1, column: 1 }
}

export const slotForDiagnostic = (
  scaffold: StructuredScaffold,
  composition: StructuredComposition,
  diagnostic: Pick<CodePracticeDiagnostic, 'line' | 'column'>,
) => {
  const entries = scaffold.slots.map((slot) => ({
    slotId: slot.id,
    range: composition.ranges[slot.id],
  }))
  const exact = entries.find(({ range }) => range && (
    diagnostic.line >= range.lineStart
    && diagnostic.line <= range.lineEnd
    && (range.lineStart !== range.lineEnd
      || (diagnostic.column >= range.columnStart && diagnostic.column <= range.columnEnd + 1))
  ))
  if (exact) return exact.slotId
  return entries
    .filter((entry) => entry.range)
    .sort((left, right) => {
      const leftDistance = Math.min(
        Math.abs(diagnostic.line - left.range.lineStart),
        Math.abs(diagnostic.line - left.range.lineEnd),
      )
      const rightDistance = Math.min(
        Math.abs(diagnostic.line - right.range.lineStart),
        Math.abs(diagnostic.line - right.range.lineEnd),
      )
      return leftDistance - rightDistance
    })[0]?.slotId ?? scaffold.slots[0].id
}

export const validateStructuredDraft = <
  ProgramAst,
  TInput,
  TOutput,
  TSkill extends ChallengeSkillDefinition,
  TBatch extends VerificationBatchBase,
  TScene extends { target: string },
>(
  challenge: AlgorithmChallenge<ProgramAst, TInput, TOutput, TSkill, TBatch, TScene>,
  draft: StructuredDraft,
  composition = composeStructuredBody(challenge.codePractice.scaffold, draft),
): StructuredValidation<ProgramAst> => {
  const missing = challenge.codePractice.scaffold.slots.find((slot) => !draft[slot.id]?.trim())
  if (missing) {
    return {
      kind: 'invalid',
      issue: {
        kind: 'required',
        slotId: missing.id,
        message: `${missing.label}还没有填写：${missing.responsibility}`,
      },
    }
  }

  let program: ProgramAst
  try {
    program = challenge.codePractice.runtime.parse(composition.source)
  } catch (error) {
    const diagnostic = diagnosticFrom(error)
    return {
      kind: 'invalid',
      issue: {
        kind: 'syntax',
        slotId: slotForDiagnostic(challenge.codePractice.scaffold, composition, diagnostic),
        message: diagnostic.message,
      },
    }
  }

  const semantic = challenge.validate(program)
  if (!semantic.valid && semantic.issue) {
    return {
      kind: 'invalid',
      issue: {
        kind: 'semantic',
        slotId: challenge.codePractice.checkToSlot[semantic.issue.check]
          ?? challenge.codePractice.scaffold.slots[0].id,
        message: semantic.issue.message,
      },
    }
  }
  return { kind: 'valid', program, semantic }
}
