import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { java } from '@codemirror/lang-java'
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
  ListTree,
  PencilLine,
  Play,
  RotateCcw,
  Send,
} from 'lucide-react'
import type { JavaDiagnostic, JavaProgram, JavaRunResult } from '../codePractice/javaSubset'
import { parseJavaSubset, runJavaSubset } from '../codePractice/javaSubset'
import {
  composeStructuredBody,
  createEmptyStructuredDraft,
  slotForDiagnostic,
  validateStructuredDraft,
  type StructuredDraft,
  type StructuredIssue,
} from '../codePractice/structuredMode'
import type {
  AlgorithmChallenge,
  CodePracticeCase,
  StructuredScaffold,
} from '../challenges/types'

const FREE_DRAFT_KEY = 'rainline:java-free-draft:v1'
const STRUCTURED_DRAFT_KEY = 'rainline:java-structured-draft:v2'
const MODE_KEY = 'rainline:java-mode:v1'

type PracticeMode = 'structured' | 'free'
type ReferenceTab = 'logic' | 'dictionary'
type MobilePane = 'reference' | 'editor'
type SlotField = HTMLInputElement

interface CaseRun {
  testCase: CodePracticeCase
  result: JavaRunResult
}

interface SubmissionState {
  passed: boolean
  passedCount: number
  total: number
  hiddenFailure: boolean
  firstPublicFailure: CaseRun | null
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

const diagnosticFrom = (error: unknown): JavaDiagnostic => {
  if (error && typeof error === 'object' && 'diagnostic' in error) {
    const diagnostic = (error as { diagnostic?: JavaDiagnostic }).diagnostic
    if (diagnostic) return diagnostic
  }
  return { kind: 'syntax', message: '代码无法解析。', line: 1, column: 1 }
}

const diagnosticLabel: Record<JavaDiagnostic['kind'], string> = {
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

const restoreStructuredDraft = (scaffold: StructuredScaffold) => {
  const empty = createEmptyStructuredDraft(scaffold)
  if (typeof window === 'undefined') return empty
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STRUCTURED_DRAFT_KEY) ?? '{}') as Record<string, unknown>
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
  draft: StructuredDraft
  issue: StructuredIssue | null
  onChange: (slotId: string, value: string) => void
  onFieldRef: (slotId: string, field: SlotField | null) => void
}

function StructuredEditor({
  scaffold,
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
    <div className="rain-structured-frame" aria-label="Java 结构填写编辑器">
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
      <div className="rain-method-boundary">{scaffold.methodClose}</div>
    </div>
  )
}

interface CodePracticeProps {
  challenge: AlgorithmChallenge<JavaProgram>
  onBack: () => void
}

export default function CodePractice({ challenge, onBack }: CodePracticeProps) {
  const scaffold = challenge.codePractice.scaffold
  const publicCases = challenge.codePractice.cases.filter((testCase) => testCase.visibility === 'public')
  const [mode, setMode] = useState<PracticeMode>(() => (
    typeof window !== 'undefined' && window.localStorage.getItem(MODE_KEY) === 'free' ? 'free' : 'structured'
  ))
  const [freeCode, setFreeCode] = useState(() => (
    typeof window === 'undefined' ? '' : window.localStorage.getItem(FREE_DRAFT_KEY) ?? ''
  ))
  const [structuredDraft, setStructuredDraft] = useState<StructuredDraft>(() => restoreStructuredDraft(scaffold))
  const [referenceTab, setReferenceTab] = useState<ReferenceTab>('logic')
  const [mobilePane, setMobilePane] = useState<MobilePane>('reference')
  const [selectedMappingId, setSelectedMappingId] = useState(challenge.codePractice.mappings[0].id)
  const [selectedCaseId, setSelectedCaseId] = useState(publicCases[0].id)
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null)
  const [revealedIssue, setRevealedIssue] = useState<StructuredIssue | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [draftSaved, setDraftSaved] = useState(true)
  const [lastRun, setLastRun] = useState<CaseRun | null>(null)
  const [submission, setSubmission] = useState<SubmissionState | null>(null)
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
      return challenge.validate(parseJavaSubset(activeCode))
    } catch {
      return null
    }
  }, [activeCode, challenge])
  const completedSteps = challenge.codePractice.referenceSteps.filter(
    (step) => semantic?.checks[step.semanticCheck],
  ).length
  const selectedCase = publicCases.find((testCase) => testCase.id === selectedCaseId) ?? publicCases[0]
  const selectedMapping = challenge.codePractice.mappings.find(
    (entry) => entry.id === selectedMappingId,
  ) ?? challenge.codePractice.mappings[0]

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(FREE_DRAFT_KEY, freeCode)
      if (mode === 'free') setDraftSaved(true)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [freeCode, mode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STRUCTURED_DRAFT_KEY, JSON.stringify(structuredDraft))
      if (mode === 'structured') setDraftSaved(true)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [mode, structuredDraft])

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
  }, [])

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
      const result = challenge.validate(parseJavaSubset(freeCode))
      if (!result.valid) return { ok: false as const, message: result.issue?.message ?? '双指针逻辑还没有连通。' }
      return { ok: true as const }
    } catch (error) {
      const diagnostic = diagnosticFrom(error)
      focusLine(diagnostic.line)
      return { ok: false as const, message: diagnostic.message, diagnostic }
    }
  }

  const runCase = (testCase: CodePracticeCase) => {
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
    const result = runJavaSubset(activeCode, testCase.input, testCase.expected)
    setSelectedCaseId(testCase.id)
    setLastRun({ testCase, result })
    if (result.diagnostic && mode === 'free') focusLine(result.diagnostic.line)
  }

  const submitAll = () => {
    const validation = validateActiveCode()
    if (!validation.ok) {
      setLastRun({
        testCase: selectedCase,
        result: {
          ok: false,
          kind: validation.diagnostic?.kind ?? 'syntax',
          message: validation.message,
          diagnostic: validation.diagnostic,
          steps: 0,
        },
      })
      setSubmission({ passed: false, passedCount: 0, total: challenge.codePractice.cases.length, hiddenFailure: false, firstPublicFailure: null })
      return
    }
    const runs = challenge.codePractice.cases.map((testCase) => ({
      testCase,
      result: runJavaSubset(activeCode, testCase.input, testCase.expected),
    }))
    const firstPublicFailure = runs.find(
      (run) => run.testCase.visibility === 'public' && !run.result.ok,
    ) ?? null
    const hiddenFailure = runs.some(
      (run) => run.testCase.visibility === 'hidden' && !run.result.ok,
    )
    const passedCount = runs.filter((run) => run.result.ok).length
    setSubmission({
      passed: passedCount === runs.length,
      passedCount,
      total: runs.length,
      hiddenFailure,
      firstPublicFailure,
    })
    if (firstPublicFailure) setLastRun(firstPublicFailure)
    else if (!hiddenFailure) setLastRun(runs[0])
    else setLastRun(null)
  }

  const resetCurrentMode = () => {
    if (mode === 'structured') {
      setStructuredDraft(createEmptyStructuredDraft(scaffold))
      window.localStorage.removeItem(STRUCTURED_DRAFT_KEY)
    } else {
      setFreeCode('')
      window.localStorage.removeItem(FREE_DRAFT_KEY)
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
    api: '数组与 API',
  }

  return (
    <section className="rain-code-shell">
      <header className="rain-code-header">
        <div className="rain-code-title">
          <span aria-hidden="true"><Code2 size={21} /></span>
          <div>
            <p>03 代码实战 · Java</p>
            <h2>把双端巡检写成代码</h2>
          </div>
        </div>
        <div className="rain-code-header-actions">
          <span className="rain-draft-state"><i className={draftSaved ? 'is-saved' : ''} />{draftSaved ? '草稿已保存' : '正在保存'}</span>
          <button type="button" onClick={onBack}><ArrowLeft size={17} />返回技能调试</button>
        </div>
      </header>

      <nav className="rain-mobile-pane-switch" aria-label="代码实战视图">
        <button type="button" className={mobilePane === 'reference' ? 'is-active' : ''} onClick={() => setMobilePane('reference')}><BookOpen size={16} />参考</button>
        <button type="button" className={mobilePane === 'editor' ? 'is-active' : ''} onClick={() => setMobilePane('editor')}><PencilLine size={16} />编辑</button>
      </nav>

      <div className={`rain-code-workbench mobile-pane-${mobilePane}`}>
        <aside className="rain-reference-panel" aria-label="Java 代码参考">
          <div className="rain-panel-heading">
            <div><p>已验证动作 → Java</p><h3>{referenceTab === 'logic' ? '完整逻辑代码' : '代码词典'}</h3></div>
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
                    <header><strong>{step.skillLabel}</strong><small className={semantic?.checks[step.semanticCheck] ? 'is-done' : ''}>{semantic?.checks[step.semanticCheck] ? <Check size={11} /> : null}{semantic?.checks[step.semanticCheck] ? '已识别' : '待填写'}</small></header>
                    <b>{step.worldAction}</b>
                    <p>{step.logicPurpose}</p>
                    <div className="rain-code-fragment">
                      <pre><code>{step.code}</code></pre>
                      <button type="button" onClick={() => void copyStep(step.id, step.code)} aria-label={`复制代码段：${step.skillLabel}`} title="复制代码段">
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

        <div className="rain-editor-panel" aria-label="Java 代码编辑器">
          <div className="rain-editor-heading">
            <div><p>方法体</p><h3><FileCode2 size={18} /> Java 代码</h3></div>
            <div className="rain-mode-switch" role="radiogroup" aria-label="代码填写方式">
              <button type="button" role="radio" aria-checked={mode === 'structured'} className={mode === 'structured' ? 'is-active' : ''} onClick={() => { setMode('structured'); clearFeedback() }}><ListTree size={14} />结构填写</button>
              <button type="button" role="radio" aria-checked={mode === 'free'} className={mode === 'free' ? 'is-active' : ''} onClick={() => { setMode('free'); clearFeedback() }}><PencilLine size={14} />自由编写</button>
            </div>
          </div>

          {mode === 'structured' ? (
            <StructuredEditor
              scaffold={scaffold}
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
                extensions={[java()]}
                onCreateEditor={(view) => { editorView.current = view }}
                onChange={(value) => {
                  setFreeCode(value)
                  setDraftSaved(false)
                  clearFeedback()
                }}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                aria-label="Java 方法体编辑器"
              />
              <div className="rain-method-boundary">{scaffold.methodClose}</div>
            </div>
          )}

          <div className={`rain-code-status ${!attempted ? 'is-neutral' : (revealedIssue || lastRun?.result.ok === false) ? 'is-error' : 'is-valid'}`} role="status">
            {!attempted ? <Code2 size={16} /> : revealedIssue || lastRun?.result.ok === false ? <CircleAlert size={16} /> : <Check size={16} />}
            <span>{!attempted
              ? mode === 'structured' ? `固定作用域已锁定，待填写 ${scaffold.slots.length} 项语义` : '尚未运行当前草稿'
              : revealedIssue?.message ?? lastRun?.result.message ?? '结构、语义与当前用例已通过'}</span>
            {revealedIssue && <button type="button" onClick={() => focusSlot(revealedIssue.slotId)}>定位填写项</button>}
          </div>

          <div className="rain-code-actions">
            <label><span>公开用例</span><select value={selectedCase.id} onChange={(event) => setSelectedCaseId(event.target.value)}>{publicCases.map((testCase) => <option key={testCase.id} value={testCase.id}>{testCase.label}</option>)}</select></label>
            <button type="button" className="is-primary" onClick={() => runCase(selectedCase)}><Play size={17} fill="currentColor" />运行当前用例</button>
            <button type="button" onClick={submitAll}><Send size={17} />提交全部用例</button>
            <button type="button" className="is-icon" onClick={resetCurrentMode} aria-label="重置当前模式" title="重置当前模式"><RotateCcw size={17} /></button>
          </div>

          <div className="rain-case-strip"><span>输入</span><code>{JSON.stringify(selectedCase.input)}</code><span>期望</span><code>{selectedCase.expected} 格</code><b>公开</b></div>

          {lastRun && (
            <div className={`rain-run-result ${lastRun.result.ok ? 'is-success' : 'is-failure'}`} role="status">
              {lastRun.result.ok ? <Check size={19} /> : <AlertTriangle size={19} />}
              <div><strong>{lastRun.result.ok ? '当前用例通过' : diagnosticLabel[lastRun.result.kind as JavaDiagnostic['kind']]}</strong><p>{lastRun.result.message}</p></div>
              {lastRun.result.diagnostic && mode === 'free' && <button type="button" onClick={() => focusLine(lastRun.result.diagnostic!.line)}>第 {lastRun.result.diagnostic.line} 行</button>}
            </div>
          )}

          {submission && (
            <div className={`rain-submission-result ${submission.passed ? 'is-success' : 'is-failure'}`} role="status">
              {submission.passed ? <Check size={20} /> : <CircleAlert size={20} />}
              <div>
                <strong>{submission.passed ? '全部公开与隐藏用例通过' : '还有用例没有通过'}</strong>
                <span>{submission.passedCount} / {submission.total}{submission.hiddenFailure ? ' · 隐藏用例未通过' : ''}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
