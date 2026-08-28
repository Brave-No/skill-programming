import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { EditorView } from '@codemirror/view'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CircleAlert,
  Code2,
  Copy,
  FileCode2,
  LayoutGrid,
  ListTree,
  PencilLine,
  Play,
  RotateCcw,
  Send,
} from 'lucide-react'
import {
  composeStructuredBody,
  createEmptyStructuredDraft,
  slotForDiagnostic,
  validateStructuredDraft,
  type StructuredDraft,
  type StructuredIssue,
} from '../codePractice/structuredMode'
import {
  CODE_LANGUAGES,
  codeLanguage,
  createLanguageChallenge,
  type CodeLanguageId,
} from '../codePractice/languages'
import type {
  AlgorithmChallenge,
  ChallengeSkillDefinition,
  CodePracticeDiagnostic,
  CodePracticeCase,
  CodePracticeRunResult,
  StructuredScaffold,
  VerificationBatchBase,
} from '../challenges/types'
import { ChallengeCompletion } from '../shared/completion'

const storageKeys = (challengeId: string, languageId: CodeLanguageId) => ({
  freeDraft: `skill-programming:${challengeId}:${languageId}-free-draft:v1`,
  structuredDraft: `skill-programming:${challengeId}:${languageId}-structured-draft:v1`,
  mode: `skill-programming:${challengeId}:${languageId}-mode:v1`,
  completion: `skill-programming:${challengeId}:completion:v1`,
})

const languageStorageKey = (challengeId: string) => `skill-programming:${challengeId}:code-language:v1`

const editorLanguageExtension = (languageId: CodeLanguageId) => {
  if (languageId === 'cpp') return cpp()
  if (languageId === 'python') return python()
  if (languageId === 'javascript') return javascript()
  return java()
}

const readStoredValue = (key: string, legacyKey?: string) => {
  if (typeof window === 'undefined') return null
  const current = window.localStorage.getItem(key)
  if (current !== null || !legacyKey) return current
  const legacy = window.localStorage.getItem(legacyKey)
  if (legacy !== null) window.localStorage.setItem(key, legacy)
  return legacy
}

type PracticeMode = 'structured' | 'free'
type ReferenceTab = 'logic' | 'dictionary'
type MobilePane = 'reference' | 'editor'
type SlotField = HTMLInputElement

interface CaseRun<TInput, TOutput> {
  testCase: CodePracticeCase<TInput, TOutput>
  result: CodePracticeRunResult<TOutput>
}

interface SubmissionState<TInput, TOutput> {
  passed: boolean
  passedCount: number
  total: number
  firstFailure: CaseRun<TInput, TOutput> | null
}

const editorTheme = EditorView.theme({
  '&': { backgroundColor: '#17211f', color: '#edf5ef', fontSize: '14px' },
  '.cm-content': {
    minHeight: '420px',
    padding: '16px 0',
    caretColor: '#f0b83e',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  '.cm-gutters': {
    minWidth: '44px',
    color: '#87948f',
    backgroundColor: '#101816',
    border: 0,
  },
  '.cm-activeLine': { backgroundColor: 'rgba(240, 184, 62, 0.08)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(240, 184, 62, 0.13)', color: '#f0b83e' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(38, 138, 151, 0.48) !important' },
  '.cm-scroller': { overflow: 'auto' },
})

const diagnosticFrom = (error: unknown): CodePracticeDiagnostic => {
  if (error && typeof error === 'object' && 'diagnostic' in error) {
    const diagnostic = (error as { diagnostic?: CodePracticeDiagnostic }).diagnostic
    if (diagnostic) return diagnostic
  }
  return { kind: 'syntax', message: '代码无法解析。', line: 1, column: 1 }
}

const diagnosticLabel: Record<CodePracticeDiagnostic['kind'], string> = {
  syntax: '语法待调整',
  unsupported: '当前语法不支持',
  runtime: '运行时问题',
  timeout: '巡检未停止',
  output: '结果不符',
}

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Browsers can expose Clipboard API while denying it in this context.
    }
  }
  const field = document.createElement('textarea')
  field.value = value
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  try {
    return document.execCommand('copy')
  } finally {
    field.remove()
  }
}

const restoreStructuredDraft = (
  scaffold: StructuredScaffold,
  storageKey: string,
  legacyStorageKey?: string,
) => {
  const empty = createEmptyStructuredDraft(scaffold)
  if (typeof window === 'undefined') return empty
  try {
    const parsed = JSON.parse(readStoredValue(storageKey, legacyStorageKey) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(
      scaffold.slots.map((slot) => [slot.id, typeof parsed[slot.id] === 'string' ? parsed[slot.id] : '']),
    ) as StructuredDraft
  } catch {
    return empty
  }
}

const statementParts = (value: string, count: number) => {
  const parts = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/;+\s*$/, ''))
    .slice(0, count)
  return [...parts, ...Array(Math.max(0, count - parts.length)).fill('')]
}

interface StructuredEditorProps {
  scaffold: StructuredScaffold
  languageLabel: string
  draft: StructuredDraft
  issue: StructuredIssue | null
  onChange: (slotId: string, value: string) => void
  onFieldRef: (slotId: string, field: SlotField | null) => void
}

function StructuredEditor({
  scaffold,
  languageLabel,
  draft,
  issue,
  onChange,
  onFieldRef,
}: StructuredEditorProps) {
  const slotById = new Map(scaffold.slots.map((slot) => [slot.id, slot]))

  const renderSlotLines = (slotId: string, suffix = '') => {
    const definition = slotById.get(slotId)!
    const parts = statementParts(draft[slotId] ?? '', definition.lineCount)
    const invalid = issue?.slotId === slotId
    return (
      <div
        className={`rain-structured-slot ${invalid ? 'is-invalid' : ''}`}
        data-slot-id={slotId}
        data-concept-ids={definition.conceptIds.join(' ')}
      >
        <span className="rain-slot-label">{definition.label}</span>
        <div className="rain-slot-lines">
          {parts.map((part, index) => (
            <label key={`${slotId}-${index}`} className="rain-slot-line">
              <span aria-hidden="true">{index + 1}</span>
              <input
                ref={(field) => { if (index === 0) onFieldRef(slotId, field) }}
                value={part}
                onChange={(event) => {
                  const next = [...parts]
                  next[index] = event.target.value.replace(/;+\s*$/, '')
                  onChange(slotId, next.join('\n'))
                }}
                aria-label={`${definition.label}第 ${index + 1} 行`}
                aria-invalid={invalid}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {suffix && <code aria-label="固定结束符">{suffix}</code>}
            </label>
          ))}
        </div>
      </div>
    )
  }

  const renderInlineSlot = (slotId: string) => {
    const definition = slotById.get(slotId)!
    const invalid = issue?.slotId === slotId
    return (
      <label className={`rain-inline-slot ${invalid ? 'is-invalid' : ''}`} data-concept-ids={definition.conceptIds.join(' ')}>
        <span>{definition.label}</span>
        <input
          ref={(field) => { onFieldRef(slotId, field) }}
          value={draft[slotId] ?? ''}
          onChange={(event) => onChange(slotId, event.target.value)}
          aria-label={definition.label}
          aria-invalid={invalid}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
    )
  }

  return (
    <div className="rain-structured-frame" aria-label={`${languageLabel} 结构填写编辑器`}>
      <div className="rain-method-boundary">{scaffold.methodOpen}</div>
      <div className="rain-structured-body">
        {scaffold.body.map((node, nodeIndex) => {
          if (node.kind === 'fixed') {
            return (
              <div key={`fixed-${nodeIndex}`} className={`rain-locked-line depth-${node.depth}`}>
                {node.value}
              </div>
            )
          }
          if (node.kind === 'slot') {
            return (
              <div key={`slot-${node.slotId}`} className={`depth-${node.depth}`}>
                {renderSlotLines(node.slotId, node.suffix ?? '')}
              </div>
            )
          }
          return (
            <div key={`composite-${nodeIndex}`} className={`rain-composite-line depth-${node.depth}`}>
              {node.segments.map((segment, segmentIndex) => (
                segment.kind === 'fixed'
                  ? <code key={`fixed-${segmentIndex}`}>{segment.value}</code>
                  : <span key={`slot-${segment.slotId}`}>{renderInlineSlot(segment.slotId)}</span>
              ))}
            </div>
          )
        })}
      </div>
      {scaffold.methodClose && <div className="rain-method-boundary">{scaffold.methodClose}</div>}
    </div>
  )
}

interface CodePracticeProps<
  ProgramAst,
  TInput,
  TOutput,
  TSkill extends ChallengeSkillDefinition,
  TBatch extends VerificationBatchBase,
  TScene extends { target: string },
> {
  challenge: AlgorithmChallenge<ProgramAst, TInput, TOutput, TSkill, TBatch, TScene>
  onBack: () => void
  onExit?: () => void
}

interface CodePracticeSessionProps<
  ProgramAst,
  TInput,
  TOutput,
  TSkill extends ChallengeSkillDefinition,
  TBatch extends VerificationBatchBase,
  TScene extends { target: string },
> extends CodePracticeProps<ProgramAst, TInput, TOutput, TSkill, TBatch, TScene> {
  languageId: CodeLanguageId
  onLanguageChange: (languageId: CodeLanguageId) => void
}

function CodePracticeSession<
  ProgramAst,
  TInput,
  TOutput,
  TSkill extends ChallengeSkillDefinition,
  TBatch extends VerificationBatchBase,
  TScene extends { target: string },
>({
  challenge,
  onBack,
  onExit,
  languageId,
  onLanguageChange,
}: CodePracticeSessionProps<ProgramAst, TInput, TOutput, TSkill, TBatch, TScene>) {
  const scaffold = challenge.codePractice.scaffold
  const language = codeLanguage(languageId)
  const keys = useMemo(() => storageKeys(challenge.id, languageId), [challenge.id, languageId])
  const runtime = challenge.codePractice.runtime
  const presentation = challenge.codePractice.presentation
  const legacyKeys = challenge.codePractice.draftStorage?.legacyKeys
  const publicCases = challenge.codePractice.cases.filter((testCase) => testCase.visibility === 'public')
  const [mode, setMode] = useState<PracticeMode>(() => (
    readStoredValue(storageKeys(challenge.id, languageId).mode, languageId === 'java' ? legacyKeys?.mode : undefined) === 'free'
      ? 'free'
      : 'structured'
  ))
  const [freeCode, setFreeCode] = useState(() => (
    readStoredValue(storageKeys(challenge.id, languageId).freeDraft, languageId === 'java' ? legacyKeys?.free : undefined) ?? ''
  ))
  const [structuredDraft, setStructuredDraft] = useState<StructuredDraft>(() => (
    restoreStructuredDraft(
      scaffold,
      storageKeys(challenge.id, languageId).structuredDraft,
      languageId === 'java' ? legacyKeys?.structured : undefined,
    )
  ))
  const [referenceTab, setReferenceTab] = useState<ReferenceTab>('logic')
  const [mobilePane, setMobilePane] = useState<MobilePane>('reference')
  const [selectedMappingId, setSelectedMappingId] = useState(challenge.codePractice.mappings[0].id)
  const [selectedCaseId, setSelectedCaseId] = useState(publicCases[0].id)
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null)
  const [revealedIssue, setRevealedIssue] = useState<StructuredIssue | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [draftSaved, setDraftSaved] = useState(true)
  const [lastRun, setLastRun] = useState<CaseRun<TInput, TOutput> | null>(null)
  const [submission, setSubmission] = useState<SubmissionState<TInput, TOutput> | null>(null)
  const [hasCompleted, setHasCompleted] = useState(() => (
    typeof window !== 'undefined' && window.localStorage.getItem(storageKeys(challenge.id, languageId).completion) !== null
  ))
  const [showCompletion, setShowCompletion] = useState(false)
  const [pendingCompletion, setPendingCompletion] = useState(false)
  const editorView = useRef<EditorView | null>(null)
  const slotFields = useRef<Record<string, SlotField | null>>({})
  const copyTimer = useRef<number | null>(null)

  const structuredComposition = useMemo(
    () => composeStructuredBody(scaffold, structuredDraft),
    [scaffold, structuredDraft],
  )
  const structuredValidation = useMemo(
    () => validateStructuredDraft(challenge, structuredDraft, structuredComposition),
    [challenge, structuredComposition, structuredDraft],
  )
  const activeCode = mode === 'structured' ? structuredComposition.source : freeCode
  const semantic = useMemo(() => {
    if (!activeCode.trim()) return null
    try {
      return challenge.validate(runtime.parse(activeCode))
    } catch {
      return null
    }
  }, [activeCode, challenge, runtime])
  const completedSteps = challenge.codePractice.referenceSteps.filter(
    (step) => semantic?.checks[step.semanticCheck],
  ).length
  const selectedCase = publicCases.find((testCase) => testCase.id === selectedCaseId) ?? publicCases[0]
  const selectedMapping = challenge.codePractice.mappings.find(
    (entry) => entry.id === selectedMappingId,
  ) ?? challenge.codePractice.mappings[0]
  const firstFailurePosition = submission?.firstFailure
    ? challenge.codePractice.cases.findIndex(
      (testCase) => testCase.id === submission.firstFailure?.testCase.id,
    ) + 1
    : 0

  useEffect(() => {
    window.localStorage.setItem(keys.mode, mode)
  }, [keys.mode, mode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(keys.freeDraft, freeCode)
      if (mode === 'free') setDraftSaved(true)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [freeCode, keys.freeDraft, mode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(keys.structuredDraft, JSON.stringify(structuredDraft))
      if (mode === 'structured') setDraftSaved(true)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [keys.structuredDraft, mode, structuredDraft])

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
  }, [])

  useEffect(() => {
    if (!pendingCompletion || !submission?.passed) return
    setShowCompletion(true)
    setPendingCompletion(false)
  }, [pendingCompletion, submission])

  const clearFeedback = () => {
    setAttempted(false)
    setRevealedIssue(null)
    setLastRun(null)
    setSubmission(null)
  }

  const focusSlot = (slotId: string) => {
    const field = slotFields.current[slotId]
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field?.focus()
  }

  const focusLine = (lineNumber: number) => {
    const view = editorView.current
    if (!view) return
    const line = view.state.doc.line(Math.max(1, Math.min(lineNumber, view.state.doc.lines)))
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    })
    view.focus()
  }

  const validateActiveCode = () => {
    setAttempted(true)
    if (mode === 'structured') {
      if (structuredValidation.kind === 'invalid') {
        setRevealedIssue(structuredValidation.issue)
        focusSlot(structuredValidation.issue.slotId)
        return { ok: false as const, message: structuredValidation.issue.message }
      }
      return { ok: true as const }
    }
    if (!freeCode.trim()) return { ok: false as const, message: '方法体还是空的。' }
    try {
      const result = challenge.validate(runtime.parse(freeCode))
      if (!result.valid) {
        return {
          ok: false as const,
          message: result.issue?.message ?? presentation.semanticFallback,
        }
      }
      return { ok: true as const }
    } catch (error) {
      const diagnostic = diagnosticFrom(error)
      focusLine(diagnostic.line)
      return { ok: false as const, message: diagnostic.message, diagnostic }
    }
  }

  const runCase = (testCase: CodePracticeCase<TInput, TOutput>) => {
    const validation = validateActiveCode()
    setSubmission(null)
    if (!validation.ok) {
      setLastRun({
        testCase,
        result: {
          ok: false,
          kind: validation.diagnostic?.kind ?? 'syntax',
          message: validation.message,
          diagnostic: validation.diagnostic,
          steps: 0,
        },
      })
      return
    }
    const result = runtime.run(activeCode, testCase.input, testCase.expected)
    setSelectedCaseId(testCase.id)
    setLastRun({ testCase, result })
    if (result.diagnostic && mode === 'free') focusLine(result.diagnostic.line)
  }

  const submitAll = () => {
    const validation = validateActiveCode()
    setLastRun(null)
    if (!validation.ok) {
      const firstFailure: CaseRun<TInput, TOutput> = {
        testCase: selectedCase,
        result: {
          ok: false,
          kind: validation.diagnostic?.kind ?? 'syntax',
          message: validation.message,
          diagnostic: validation.diagnostic,
          steps: 0,
        },
      }
      setSubmission({
        passed: false,
        passedCount: 0,
        total: challenge.codePractice.cases.length,
        firstFailure,
      })
      return
    }
    const runs = challenge.codePractice.cases.map((testCase) => ({
      testCase,
      result: runtime.run(activeCode, testCase.input, testCase.expected),
    }))
    const firstFailure = runs.find((run) => !run.result.ok) ?? null
    const passedCount = runs.filter((run) => run.result.ok).length
    const nextSubmission = {
      passed: passedCount === runs.length,
      passedCount,
      total: runs.length,
      firstFailure,
    }
    if (nextSubmission.passed && !hasCompleted) {
      window.localStorage.setItem(keys.completion, JSON.stringify({
        completed: true,
        passedCount,
        total: runs.length,
        completedAt: new Date().toISOString(),
      }))
      setHasCompleted(true)
      setSubmission(nextSubmission)
      setPendingCompletion(true)
      return
    }
    setSubmission(nextSubmission)
  }

  const resetCurrentMode = () => {
    if (mode === 'structured') {
      setStructuredDraft(createEmptyStructuredDraft(scaffold))
      window.localStorage.removeItem(keys.structuredDraft)
    } else {
      setFreeCode('')
      window.localStorage.removeItem(keys.freeDraft)
    }
    setDraftSaved(false)
    clearFeedback()
  }

  const copyStep = async (stepId: string, code: string) => {
    if (!await copyText(code)) return
    setCopiedStepId(stepId)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopiedStepId(null), 1200)
  }

  const categoryLabels = {
    scene: '场景对象',
    skill: '技能动作',
    syntax: '语法结构',
    api: presentation.dictionaryApiLabel,
  }

  return (
    <section className="rain-code-shell">
      <header className="rain-code-header">
        <div className="rain-code-title">
          <span aria-hidden="true"><Code2 size={21} /></span>
          <div>
            <p>{presentation.eyebrow}</p>
            <h2>{presentation.title}</h2>
          </div>
        </div>
        <div className="rain-code-header-actions">
          <label className="rain-language-picker">
            <span>提交语言</span>
            <select
              value={languageId}
              aria-label="提交语言"
              onChange={(event) => onLanguageChange(event.target.value as CodeLanguageId)}
            >
              {CODE_LANGUAGES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <span className="rain-draft-state"><i className={draftSaved ? 'is-saved' : ''} />{draftSaved ? '草稿已保存' : '正在保存'}</span>
          {onExit && <button type="button" onClick={onExit}><LayoutGrid size={17} />挑战选择</button>}
          <button type="button" onClick={onBack}><ArrowLeft size={17} />返回技能调试</button>
        </div>
      </header>

      <nav className="rain-mobile-pane-switch" aria-label="代码实战视图">
        <button type="button" className={mobilePane === 'reference' ? 'is-active' : ''} onClick={() => setMobilePane('reference')}><BookOpen size={16} />参考</button>
        <button type="button" className={mobilePane === 'editor' ? 'is-active' : ''} onClick={() => setMobilePane('editor')}><PencilLine size={16} />编辑</button>
      </nav>

      <div className={`rain-code-workbench mobile-pane-${mobilePane}`}>
        <aside className="rain-reference-panel" aria-label={`${language.label} 代码参考`}>
          <div className="rain-panel-heading">
            <div><p>{`已验证动作 → ${language.label}`}</p><h3>{referenceTab === 'logic' ? '完整逻辑代码' : '代码词典'}</h3></div>
            {referenceTab === 'logic' && <span>{completedSteps}/{challenge.codePractice.referenceSteps.length}</span>}
          </div>
          <div className="rain-reference-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={referenceTab === 'logic'} className={referenceTab === 'logic' ? 'is-active' : ''} onClick={() => setReferenceTab('logic')}><ListTree size={15} />逻辑代码</button>
            <button type="button" role="tab" aria-selected={referenceTab === 'dictionary'} className={referenceTab === 'dictionary' ? 'is-active' : ''} onClick={() => setReferenceTab('dictionary')}><BookOpen size={15} />代码词典</button>
          </div>

          {referenceTab === 'logic' ? (
            <div className="rain-logic-track" role="tabpanel">
              {challenge.codePractice.referenceSteps.map((step) => (
                <article key={step.id} className={`rain-logic-step depth-${step.depth} tone-${step.tone}`} data-step-id={step.id} data-concept-ids={step.conceptIds.join(' ')}>
                  <span aria-hidden="true">{step.order}</span>
                  <div>
                    <header><strong>{step.stepLabel}</strong><small className={semantic?.checks[step.semanticCheck] ? 'is-done' : ''}>{semantic?.checks[step.semanticCheck] ? <Check size={11} /> : null}{semantic?.checks[step.semanticCheck] ? '已识别' : '待填写'}</small></header>
                    <b>{step.worldAction}</b>
                    <p>{step.logicPurpose}</p>
                    <div className="rain-code-fragment">
                      <pre><code>{step.code}</code></pre>
                      <button type="button" onClick={() => void copyStep(step.id, step.code)} aria-label={`复制代码段：${step.stepLabel}`} title="复制代码段">
                        {copiedStepId === step.id ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rain-dictionary" role="tabpanel">
              {(['scene', 'skill', 'syntax', 'api'] as const).map((category) => (
                <section key={category}>
                  <h4>{categoryLabels[category]}</h4>
                  <div>
                    {challenge.codePractice.mappings.filter((entry) => entry.category === category).map((entry) => (
                      <button key={entry.id} type="button" className={selectedMapping.id === entry.id ? 'is-active' : ''} data-concept-ids={entry.conceptIds.join(' ')} onClick={() => setSelectedMappingId(entry.id)}>{entry.label}</button>
                    ))}
                  </div>
                </section>
              ))}
              <div className="rain-mapping-detail">
                <strong>{selectedMapping.label}</strong>
                <p>{selectedMapping.worldMeaning}</p>
                <code>{selectedMapping.code}</code>
              </div>
            </div>
          )}
        </aside>

        <div className="rain-editor-panel" aria-label={`${language.label} 代码编辑器`}>
          <div className="rain-editor-heading">
            <div><p>{presentation.methodBodyLabel}</p><h3><FileCode2 size={18} /> {language.label} 代码</h3></div>
            <div className="rain-mode-switch" role="radiogroup" aria-label="代码填写方式">
              <button type="button" role="radio" aria-checked={mode === 'structured'} className={mode === 'structured' ? 'is-active' : ''} onClick={() => { setMode('structured'); clearFeedback() }}><ListTree size={14} />结构填写</button>
              <button type="button" role="radio" aria-checked={mode === 'free'} className={mode === 'free' ? 'is-active' : ''} onClick={() => { setMode('free'); clearFeedback() }}><PencilLine size={14} />自由编写</button>
            </div>
          </div>

          {mode === 'structured' ? (
            <StructuredEditor
              scaffold={scaffold}
              languageLabel={language.label}
              draft={structuredDraft}
              issue={revealedIssue}
              onFieldRef={(slotId, field) => { slotFields.current[slotId] = field }}
              onChange={(slotId, value) => {
                setStructuredDraft((current) => ({ ...current, [slotId]: value }))
                setDraftSaved(false)
                clearFeedback()
              }}
            />
          ) : (
            <div className="rain-free-editor">
              <div className="rain-method-boundary">{scaffold.methodOpen}</div>
              <CodeMirror
                value={freeCode}
                height="510px"
                theme={editorTheme}
                extensions={[editorLanguageExtension(languageId)]}
                onCreateEditor={(view) => { editorView.current = view }}
                onChange={(value) => {
                  setFreeCode(value)
                  setDraftSaved(false)
                  clearFeedback()
                }}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                aria-label={`${language.label} 方法体编辑器`}
              />
              {scaffold.methodClose && <div className="rain-method-boundary">{scaffold.methodClose}</div>}
            </div>
          )}

          <div className={`rain-code-status ${!attempted ? 'is-neutral' : (revealedIssue || lastRun?.result.ok === false || submission?.firstFailure) ? 'is-error' : 'is-valid'}`} role="status">
            {!attempted ? <Code2 size={16} /> : revealedIssue || lastRun?.result.ok === false || submission?.firstFailure ? <CircleAlert size={16} /> : <Check size={16} />}
            <span>{!attempted
              ? mode === 'structured' ? `固定作用域已锁定，待填写 ${scaffold.slots.length} 项语义` : presentation.neutralFreeMessage
              : revealedIssue?.message ?? lastRun?.result.message ?? submission?.firstFailure?.result.message ?? '结构、语义与当前用例已通过'}</span>
            {revealedIssue && <button type="button" onClick={() => focusSlot(revealedIssue.slotId)}>定位填写项</button>}
          </div>

          <div className="rain-code-actions">
            <label><span>公开用例</span><select value={selectedCase.id} onChange={(event) => setSelectedCaseId(event.target.value)}>{publicCases.map((testCase) => <option key={testCase.id} value={testCase.id}>{testCase.label}</option>)}</select></label>
            <button type="button" className="is-primary" onClick={() => runCase(selectedCase)}><Play size={17} fill="currentColor" />运行当前用例</button>
            <button type="button" onClick={submitAll}><Send size={17} />提交全部用例</button>
            <button type="button" className="is-icon" onClick={resetCurrentMode} aria-label="重置当前模式" title="重置当前模式"><RotateCcw size={17} /></button>
          </div>

          <div className="rain-case-strip"><span>输入</span><code>{runtime.formatInput(selectedCase.input)}</code><span>期望</span><code>{runtime.formatOutput(selectedCase.expected)}</code><b>公开</b></div>

          {lastRun && (
            <div className={`rain-run-result ${lastRun.result.ok ? 'is-success' : 'is-failure'}`} role="status">
              {lastRun.result.ok ? <Check size={19} /> : <AlertTriangle size={19} />}
              <div><strong>{lastRun.result.ok ? '当前用例通过' : diagnosticLabel[lastRun.result.kind as CodePracticeDiagnostic['kind']]}</strong><p>{lastRun.result.message}</p></div>
              {lastRun.result.diagnostic && mode === 'free' && <button type="button" onClick={() => focusLine(lastRun.result.diagnostic!.line)}>第 {lastRun.result.diagnostic.line} 行</button>}
            </div>
          )}

          {submission && (
            <div className={`rain-submission-result ${submission.passed ? 'is-success' : 'is-failure'}`} role="status">
              {submission.passed ? <Check size={20} /> : <CircleAlert size={20} />}
              <div className="rain-submission-content">
                <div className="rain-submission-summary">
                  <strong>{submission.passed ? '全部公开与隐藏用例通过' : '还有用例没有通过'}</strong>
                  <span>{submission.passedCount} / {submission.total}</span>
                </div>
                {submission.firstFailure && (
                  <section className="rain-failure-example" aria-label="当前卡住的用例">
                    <header>
                      <div>
                        <strong>当前卡住的用例</strong>
                        <span>第 {firstFailurePosition} 个用例 · {submission.firstFailure.testCase.label}</span>
                      </div>
                      <b>{submission.firstFailure.testCase.visibility === 'hidden' ? '隐藏 · 提交后揭示' : '公开'}</b>
                    </header>
                    <dl>
                      <div className="is-wide">
                        <dt>输入</dt>
                        <dd><code>{runtime.formatInput(submission.firstFailure.testCase.input)}</code></dd>
                      </div>
                      <div>
                        <dt>期望</dt>
                        <dd><code>{runtime.formatOutput(submission.firstFailure.testCase.expected)}</code></dd>
                      </div>
                      <div>
                        <dt>实际</dt>
                        <dd>
                          {submission.firstFailure.result.value === undefined
                            ? '未产生返回值'
                            : <code>{runtime.formatOutput(submission.firstFailure.result.value)}</code>}
                        </dd>
                      </div>
                      <div className="is-wide">
                        <dt>原因</dt>
                        <dd>{submission.firstFailure.result.message}</dd>
                      </div>
                    </dl>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showCompletion && submission?.passed && (
        <ChallengeCompletion
          passedCount={submission.passedCount}
          total={submission.total}
          onClose={() => setShowCompletion(false)}
        />
      )}
    </section>
  )
}

export default function CodePractice<
  ProgramAst,
  TInput,
  TOutput,
  TSkill extends ChallengeSkillDefinition,
  TBatch extends VerificationBatchBase,
  TScene extends { target: string },
>(props: CodePracticeProps<ProgramAst, TInput, TOutput, TSkill, TBatch, TScene>) {
  const { challenge } = props
  const [languageId, setLanguageId] = useState<CodeLanguageId>(() => {
    if (typeof window === 'undefined') return challenge.languageId
    const stored = window.localStorage.getItem(languageStorageKey(challenge.id))
    return CODE_LANGUAGES.some((language) => language.id === stored)
      ? stored as CodeLanguageId
      : challenge.languageId
  })
  const translatedChallenge = useMemo(
    () => createLanguageChallenge(challenge, languageId),
    [challenge, languageId],
  )

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey(challenge.id), languageId)
  }, [challenge.id, languageId])

  return (
    <CodePracticeSession
      key={`${challenge.id}:${languageId}`}
      {...props}
      challenge={translatedChallenge}
      languageId={languageId}
      onLanguageChange={setLanguageId}
    />
  )
}
