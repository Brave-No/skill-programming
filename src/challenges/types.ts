import type { CodeLanguageId } from '../codePractice/languages'

export interface StrategyDefinition {
  id: string
  label: string
  summary: string
}

export type AlgorithmConceptKind =
  | 'input'
  | 'output'
  | 'state'
  | 'operation'
  | 'control'
  | 'api'
  | 'boundary'

export interface AlgorithmConceptDefinition {
  id: string
  kind: AlgorithmConceptKind
  label: string
  worldMeaning: string
  canonicalCode: string
  lifecycle?: {
    initialization: string
    reads: string[]
    writes: string[]
    updateRule: string
  }
  links: {
    sceneIds: string[]
    // A concept may be expanded inside a core skill or live only in trace/code artifacts.
    skillIds: string[]
    traceFields: string[]
    referenceStepIds: string[]
    mappingEntryIds: string[]
    structuredSlotIds: string[]
    semanticChecks: string[]
  }
}

export interface VerificationBatchBase {
  id: string
  name: string
}

export interface VerificationBatch extends VerificationBatchBase {
  terrain: number[]
  expectedTotal: number
}

export interface SkillProgramContract {
  initialState: 'empty'
  invalidateVerificationOnEdit: true
  allowDirectSuiteValidation: true
}

export interface CodePracticeCase<TInput = number[], TOutput = number> {
  id: string
  label: string
  input: TInput
  expected: TOutput
  visibility: 'public' | 'hidden'
}

export interface CodePracticeDiagnostic {
  kind: 'syntax' | 'unsupported' | 'runtime' | 'timeout' | 'output'
  message: string
  line: number
  column: number
}

export interface CodePracticeRunResult<TOutput> {
  ok: boolean
  kind: 'success' | CodePracticeDiagnostic['kind']
  message: string
  value?: TOutput
  expected?: TOutput
  diagnostic?: CodePracticeDiagnostic
  steps: number
}

export interface CodePracticeRuntime<ProgramAst, TInput, TOutput> {
  parse: (source: string) => ProgramAst
  run: (source: string, input: TInput, expected?: TOutput) => CodePracticeRunResult<TOutput>
  formatInput: (input: TInput) => string
  formatOutput: (output: TOutput | undefined) => string
}

export interface CodePracticePresentation {
  eyebrow: string
  title: string
  methodBodyLabel: string
  dictionaryApiLabel: string
  neutralFreeMessage: string
  semanticFallback: string
}

export interface CodePracticeDraftStorage {
  legacyKeys?: {
    free?: string
    structured?: string
    mode?: string
  }
}

export interface ChallengeSkillDefinition {
  type: string
  label: string
  shortLabel: string
  description: string
  tone: LogicStepTone
  createsScope: boolean
  // One player-facing core skill may group several implementation-level concepts.
  conceptIds: string[]
}

export type LogicStepTone = 'yellow' | 'ink' | 'teal' | 'coral' | 'steel'
export type LogicStepRole = 'action' | 'open-scope' | 'branch' | 'close-scope' | 'result'

export interface LogicCodeStep {
  id: string
  order: number
  // Reference steps can be finer-grained than the player-facing skill library.
  stepLabel: string
  worldAction: string
  logicPurpose: string
  role: LogicStepRole
  depth: 0 | 1 | 2
  tone: LogicStepTone
  code: string
  semanticCheck: string
  conceptIds: string[]
}

export interface CodeMappingEntry {
  id: string
  category: 'scene' | 'skill' | 'syntax' | 'api'
  label: string
  worldMeaning: string
  code: string
  conceptIds: string[]
}

export interface StructuredSlotDefinition {
  id: string
  label: string
  responsibility: string
  lineCount: number
  conceptIds: string[]
}

export type StructuredScaffoldNode =
  | { kind: 'fixed'; depth: number; value: string }
  | { kind: 'slot'; depth: number; slotId: string; suffix?: string }
  | {
      kind: 'composite'
      depth: number
      segments: Array<{ kind: 'fixed'; value: string } | { kind: 'slot'; slotId: string }>
    }

export interface StructuredScaffold {
  methodOpen: string
  methodClose: string
  slots: StructuredSlotDefinition[]
  body: StructuredScaffoldNode[]
}

export interface SemanticIssue {
  check: string
  message: string
}

export interface SemanticResult {
  valid: boolean
  checks: Record<string, boolean>
  issue?: SemanticIssue
}

export interface AlgorithmChallenge<
  ProgramAst,
  TInput = number[],
  TOutput = number,
  TSkill extends ChallengeSkillDefinition = ChallengeSkillDefinition,
  TBatch extends VerificationBatchBase = VerificationBatch,
  TScene extends { target: string } = { observeTerrain: number[]; target: string },
> {
  id: string
  title: string
  strategy: StrategyDefinition
  languageId: CodeLanguageId
  concepts: AlgorithmConceptDefinition[]
  scene: TScene
  manualStage: {
    prompt: string
  }
  skills: TSkill[]
  automationStage: {
    programContract: SkillProgramContract
    verificationBatches: TBatch[]
  }
  codePractice: {
    methodSignature: string
    scaffold: StructuredScaffold
    referenceSteps: LogicCodeStep[]
    mappings: CodeMappingEntry[]
    cases: CodePracticeCase<TInput, TOutput>[]
    runtime: CodePracticeRuntime<ProgramAst, TInput, TOutput>
    presentation: CodePracticePresentation
    checkToSlot: Record<string, string>
    draftStorage?: CodePracticeDraftStorage
  }
  validate: (program: ProgramAst) => SemanticResult
}
