import {
  codeLanguage,
  normalizeLanguageSource,
  translateCodeSteps,
  translateJavaSource,
  translateMethodSignature,
  type CodeLanguageId,
} from '../../../../../src/codePractice/languages'
import {
  JAVA_MAPPING_ENTRIES,
  type CodeMappingEntry,
} from './mappings'
import {
  JAVA_LOGIC_REFERENCE,
  type LanguageLogicReference,
  type LogicCodeStep,
} from './logicReference'
import {
  STRUCTURED_SCAFFOLD,
  STRUCTURED_SLOT_DEFINITIONS,
  type StructuredScaffold,
  type StructuredSlotDefinition,
  type StructuredSlotId,
} from './structuredMode'

const JAVA_METHOD_SIGNATURE = JAVA_LOGIC_REFERENCE.methodSignature

const translateMappingCode = (code: string, languageId: CodeLanguageId) => {
  if (languageId === 'java') return code
  const declarations: Record<Exclude<CodeLanguageId, 'java'>, Record<string, string>> = {
    cpp: {
      'int[] nums': 'vector<int>& nums',
      'int writeIndex': 'int writeIndex',
      'int scanIndex': 'int scanIndex',
      'int temp;': 'int temp;',
    },
    python: {
      'int[] nums': 'nums',
      'int writeIndex': 'writeIndex',
      'int scanIndex': 'scanIndex',
      'int temp;': 'temp',
    },
    javascript: {
      'int[] nums': 'nums',
      'int writeIndex': 'let writeIndex',
      'int scanIndex': 'let scanIndex',
      'int temp;': 'let temp;',
    },
  }
  return declarations[languageId][code] ?? translateJavaSource(code, languageId).trim()
}

const createMappings = (languageId: CodeLanguageId): CodeMappingEntry[] => (
  JAVA_MAPPING_ENTRIES.map((entry) => ({
    ...entry,
    snippets: entry.snippets.map((snippet) => ({
      ...snippet,
      languageId,
      label: codeLanguage(languageId).label,
      code: translateMappingCode(snippet.code, languageId),
    })),
  }))
)

const createPythonReference = (): LanguageLogicReference => {
  const steps = translateCodeSteps(JAVA_LOGIC_REFERENCE.steps, 'python')
  const byId = new Map(steps.map((step) => [step.id, step]))
  const replace = (id: string, patch: Partial<LogicCodeStep>) => ({ ...byId.get(id)!, ...patch })

  return {
    languageId: 'python',
    label: 'Python',
    methodSignature: translateMethodSignature(JAVA_METHOD_SIGNATURE, 'python'),
    steps: [
      replace('initialize-write-pointer', {
        code: 'writeIndex = 0',
      }),
      replace('open-scan-loop', {
        code: 'for scanIndex in range(len(nums)):',
        structuredSlotIds: ['loop-init'],
      }),
      replace('open-cargo-condition', {
        code: '    if nums[scanIndex] != 0:',
      }),
      replace('swap-cargo', {
        code: '        temp = nums[scanIndex]\n        nums[scanIndex] = nums[writeIndex]\n        nums[writeIndex] = temp',
      }),
      replace('advance-write-pointer', {
        code: '        writeIndex += 1',
      }),
      replace('close-cargo-condition', {
        code: '    # 结束有货分支',
      }),
      replace('close-scan-loop', {
        code: '# 遍历完成',
      }),
    ],
  }
}

const createReference = (languageId: CodeLanguageId): LanguageLogicReference => {
  if (languageId === 'python') return createPythonReference()
  return {
    ...JAVA_LOGIC_REFERENCE,
    languageId,
    label: codeLanguage(languageId).label,
    methodSignature: translateMethodSignature(JAVA_METHOD_SIGNATURE, languageId),
    steps: translateCodeSteps(JAVA_LOGIC_REFERENCE.steps, languageId),
  }
}

const pythonScaffold: StructuredScaffold = {
  methodOpen: `${translateMethodSignature(JAVA_METHOD_SIGNATURE, 'python')}:`,
  methodClose: '',
  body: [
    {
      id: 'preparation',
      kind: 'statement-group',
      slotId: 'preparation',
      depth: 0,
      lineCount: 3,
      statementTerminator: '',
    },
    { id: 'preparation-gap', kind: 'blank' },
    {
      id: 'loop',
      kind: 'line',
      depth: 0,
      segments: [
        { kind: 'fixed', value: 'for ' },
        { kind: 'slot', slotId: 'loop-init' },
        { kind: 'fixed', value: ':' },
      ],
    },
    {
      id: 'condition',
      kind: 'line',
      depth: 1,
      segments: [
        { kind: 'fixed', value: 'if ' },
        { kind: 'slot', slotId: 'occupied-condition' },
        { kind: 'fixed', value: ':' },
      ],
    },
    {
      id: 'swap',
      kind: 'statement-group',
      slotId: 'swap',
      depth: 2,
      lineCount: 3,
      statementTerminator: '',
    },
    {
      id: 'update',
      kind: 'line',
      depth: 2,
      segments: [{ kind: 'slot', slotId: 'slow-update' }],
    },
  ],
}

const createScaffold = (languageId: CodeLanguageId): StructuredScaffold => {
  if (languageId === 'python') return pythonScaffold
  if (languageId === 'java') return STRUCTURED_SCAFFOLD
  return {
    ...STRUCTURED_SCAFFOLD,
    methodOpen: `${translateMethodSignature(JAVA_METHOD_SIGNATURE, languageId)} {`,
  }
}

const createSlotDefinitions = (languageId: CodeLanguageId): StructuredSlotDefinition[] => {
  if (languageId !== 'python') return STRUCTURED_SLOT_DEFINITIONS
  return STRUCTURED_SLOT_DEFINITIONS
    .filter((definition) => !['loop-condition', 'loop-update'].includes(definition.id))
    .map((definition) => definition.id === 'loop-init'
      ? {
          ...definition,
          label: '遍历范围',
          shortLabel: '扫描范围',
          placeholder: 'scanIndex in range(len(nums))',
        }
      : definition)
}

export interface MoveZeroesLanguagePractice {
  id: CodeLanguageId
  label: string
  methodSignature: string
  reference: LanguageLogicReference
  mappings: CodeMappingEntry[]
  scaffold: StructuredScaffold
  slotDefinitions: StructuredSlotDefinition[]
  requiredSlotIds: StructuredSlotId[]
  issueSlotAliases: Partial<Record<StructuredSlotId, StructuredSlotId>>
  normalize: (source: string) => string
}

export const createMoveZeroesLanguagePractice = (
  languageId: CodeLanguageId,
): MoveZeroesLanguagePractice => ({
  id: languageId,
  label: codeLanguage(languageId).label,
  methodSignature: translateMethodSignature(JAVA_METHOD_SIGNATURE, languageId),
  reference: createReference(languageId),
  mappings: createMappings(languageId),
  scaffold: createScaffold(languageId),
  slotDefinitions: createSlotDefinitions(languageId),
  requiredSlotIds: languageId === 'python'
    ? ['preparation', 'loop-init', 'occupied-condition', 'swap', 'slow-update']
    : ['preparation', 'loop-init', 'loop-condition', 'loop-update', 'occupied-condition', 'swap', 'slow-update'],
  issueSlotAliases: languageId === 'python'
    ? { 'loop-condition': 'loop-init', 'loop-update': 'loop-init' }
    : {},
  normalize: (source) => normalizeLanguageSource(source, languageId, JAVA_METHOD_SIGNATURE),
})
