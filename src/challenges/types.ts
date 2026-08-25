import type { SkillDefinition, SkillType } from '../game/model'

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
    skillIds: SkillType[]
    traceFields: string[]
    referenceStepIds: string[]
    mappingEntryIds: string[]
    structuredSlotIds: string[]
    semanticChecks: string[]
  }
}

export interface VerificationBatch {
  id: string
  name: string
  terrain: number[]
  expectedTotal: number
}

export interface SkillProgramContract {
  initialState: 'empty'
  invalidateVerificationOnEdit: true
  allowDirectSuiteValidation: true
}

export interface CodePracticeCase {
  id: string
  label: string
  input: number[]
  expected: number
  visibility: 'public' | 'hidden'
}

export type LogicStepTone = 'yellow' | 'ink' | 'teal' | 'coral' | 'steel'
export type LogicStepRole = 'action' | 'open-scope' | 'branch' | 'close-scope' | 'result'

export interface LogicCodeStep {
  id: string
  order: number
  skillLabel: string
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
  | { kind: 'fixed'; depth: 0 | 1 | 2; value: string }
  | { kind: 'slot'; depth: 0 | 1 | 2; slotId: string; suffix?: string }
  | {
      kind: 'composite'
      depth: 0 | 1 | 2
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

export interface AlgorithmChallenge<ProgramAst> {
  id: string
  title: string
  strategy: StrategyDefinition
  languageId: 'java'
  concepts: AlgorithmConceptDefinition[]
  scene: {
    observeTerrain: number[]
    target: string
  }
  manualStage: {
    prompt: string
  }
  skills: SkillDefinition[]
  automationStage: {
    programContract: SkillProgramContract
    verificationBatches: VerificationBatch[]
  }
  codePractice: {
    methodSignature: string
    scaffold: StructuredScaffold
    referenceSteps: LogicCodeStep[]
    mappings: CodeMappingEntry[]
    cases: CodePracticeCase[]
  }
  validate: (program: ProgramAst) => SemanticResult
}
