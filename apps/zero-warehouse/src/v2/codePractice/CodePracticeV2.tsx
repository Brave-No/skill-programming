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
  Sparkles,
} from 'lucide-react'
import {
  JAVA_MAPPING,
  JAVA_MAPPING_ENTRIES,
  MAPPING_CATEGORY_LABELS,
  MAPPING_CATEGORY_ORDER,
  EMPTY_JAVA_BODY,
  type CodeMappingEntry,
} from './mappings'
import { CODE_PRACTICE_CASES, PUBLIC_CODE_PRACTICE_CASES, type CodePracticeCase } from './cases'
import { parseJavaSubset, runJavaSubset, type JavaDiagnostic, type JavaRunResult } from './javaSubset'
import {
  JAVA_LOGIC_REFERENCE,
  analyzeLogicStepProgress,
  type LogicCodeStep,
} from './logicReference'
import {
  STRUCTURED_SLOT_DEFINITIONS,
  STRUCTURED_SCAFFOLD,
  composeStructuredBody,
  createEmptyStructuredDraft,
  restoreStructuredDraft,
  slotForDiagnostic,
  validateStructuredDraft,
  type StructuredDraft,
  type StructuredSlotId,
  type StructuredSlotIssue,
} from './structuredMode'

const FREE_DRAFT_KEY = 'zero-warehouse:v2:java-code-draft:v2'
const STRUCTURED_DRAFT_KEY = 'zero-warehouse:v2:java-structured-draft:v1'
const MODE_KEY = 'zero-warehouse:v2:java-code-mode:v1'

type PracticeMode = 'structured' | 'free'
type SlotField = HTMLInputElement | HTMLTextAreaElement

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#18231f',
    color: '#edf5ef',
    fontSize: '14px',
  },
  '.cm-content': {
    minHeight: '440px',
    padding: '18px 0',
    caretColor: '#f2c94c',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  '.cm-gutters': {
    backgroundColor: '#121a17',
    color: '#789083',
    border: 0,
    minWidth: '46px',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(242, 201, 76, 0.08)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(242, 201, 76, 0.13)', color: '#f2c94c' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(12, 143, 125, 0.5) !important' },
  '.cm-scroller': { overflow: 'auto' },
})

type ParseState =
  | { kind: 'empty' }
  | { kind: 'valid' }
  | { kind: 'invalid'; message: string; diagnostic?: JavaDiagnostic; slotIssue?: StructuredSlotIssue }

interface CaseRun {
  testCase: CodePracticeCase
  result: JavaRunResult
}

interface SubmissionState {
  passed: boolean
  passedCount: number
  total: number
  firstFailure: CaseRun | null
}

const diagnosticFrom = (error: unknown): JavaDiagnostic => {
  if (error && typeof error === 'object' && 'diagnostic' in error) {
    const diagnostic = (error as { diagnostic?: JavaDiagnostic }).diagnostic
    if (diagnostic) return diagnostic
  }
  return { kind: 'syntax', message: '代码无法解析。', line: 1, column: 1 }
}

const diagnosticLabel: Record<JavaDiagnostic['kind'], string> = {
  syntax: '语法错误',
  unsupported: '暂不支持的语法',
  runtime: '运行错误',
  timeout: '运行超时',
  output: '输出不符',
}

const DICTIONARY_CATEGORY_ORDER = MAPPING_CATEGORY_ORDER.filter((category) => category !== 'skill-action')

const entriesByCategory = (entries: CodeMappingEntry[]) =>
  DICTIONARY_CATEGORY_ORDER.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category),
  }))

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const field = document.createElement('textarea')
  field.value = value
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  document.execCommand('copy')
  field.remove()
}

export interface CodePracticeV2Props {
  onBack: () => void
}

const SLOT_DEFINITION_BY_ID = Object.fromEntries(
  STRUCTURED_SLOT_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<StructuredSlotId, (typeof STRUCTURED_SLOT_DEFINITIONS)[number]>

const statementParts = (value: string, count: number) => {
  const parts = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/;+\s*$/, ''))
    .slice(0, count)
  return [...parts, ...Array(Math.max(0, count - parts.length)).fill('')]
}

interface StructuredEditorProps {
  draft: StructuredDraft
  issue?: StructuredSlotIssue
  onChange: (slotId: StructuredSlotId, value: string) => void
  onFieldRef: (slotId: StructuredSlotId, field: SlotField | null) => void
}

function StructuredEditor({ draft, issue, onChange, onFieldRef }: StructuredEditorProps) {
  const renderStatementGroup = (
    slotId: StructuredSlotId,
    count: number,
    depth: 0 | 1 | 2,
    statementTerminator: string,
  ) => {
    const definition = SLOT_DEFINITION_BY_ID[slotId]
    const parts = statementParts(draft[slotId], count)
    const invalid = issue?.slotId === slotId
    return (
      <div
        className={`structured-statement-slot depth-${depth} ${invalid ? 'is-invalid' : ''}`}
        data-slot-id={slotId}
      >
        <span className="structured-slot-label">{definition.label}</span>
        <div className="structured-statement-lines">
          {parts.map((part, index) => (
            <label key={`${slotId}-${index}`} className="structured-statement-line">
              <span className="structured-line-number" aria-hidden="true">{index + 1}</span>
              <input
                ref={(field) => { if (index === 0) onFieldRef(slotId, field) }}
                value={part}
                onChange={(event) => {
                  const nextParts = [...parts]
                  nextParts[index] = event.target.value.replace(/;+\s*$/, '')
                  onChange(slotId, nextParts.join('\n'))
                }}
                aria-label={`${definition.label}第 ${index + 1} 行`}
                aria-invalid={invalid}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="structured-fixed-token" aria-label="固定语句结束符">{statementTerminator}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  const renderInlineSlot = (slotId: StructuredSlotId) => {
    const definition = SLOT_DEFINITION_BY_ID[slotId]
    const invalid = issue?.slotId === slotId
    return (
      <label className={`structured-inline-slot ${invalid ? 'is-invalid' : ''}`} data-slot-id={slotId}>
        <span>{definition.shortLabel}</span>
        <input
          ref={(field) => { onFieldRef(slotId, field) }}
          value={draft[slotId]}
          onChange={(event) => onChange(slotId, event.target.value.replace(/;+\s*$/, ''))}
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
    <div className="structured-code-frame" aria-label="Java 结构填写编辑器">
      <div className="code-method-signature">{STRUCTURED_SCAFFOLD.methodOpen}</div>
      <div className="structured-method-body">
        {STRUCTURED_SCAFFOLD.body.map((node) => {
          if (node.kind === 'blank') {
            return <div key={node.id} className="structured-blank-line" aria-hidden="true" />
          }
          if (node.kind === 'statement-group') {
            return (
              <div key={node.id}>
                {renderStatementGroup(node.slotId, node.lineCount, node.depth, node.statementTerminator)}
              </div>
            )
          }
          if (node.kind === 'fixed-line') {
            return (
              <div
                key={node.id}
                className={`structured-code-line depth-${node.depth} is-locked-line`}
                aria-label={node.lockedLabel}
              >
                {node.value}
              </div>
            )
          }
          return (
            <div key={node.id} className={`structured-code-line depth-${node.depth} is-${node.id}-line`}>
              {node.segments.map((segment, index) => (
                segment.kind === 'fixed'
                  ? <span key={`${node.id}-${index}`} className="structured-fixed-token">{segment.value}</span>
                  : <span key={`${node.id}-${segment.slotId}`}>{renderInlineSlot(segment.slotId)}</span>
              ))}
            </div>
          )
        })}
      </div>
      <div className="code-method-signature code-method-close">{STRUCTURED_SCAFFOLD.methodClose}</div>
    </div>
  )
}

export function CodePracticeV2({ onBack }: CodePracticeV2Props) {
  const [mode, setMode] = useState<PracticeMode>(() => {
    if (typeof window === 'undefined') return 'structured'
    return window.localStorage.getItem(MODE_KEY) === 'free' ? 'free' : 'structured'
  })
  const [freeCode, setFreeCode] = useState(() => {
    if (typeof window === 'undefined') return EMPTY_JAVA_BODY
    return window.localStorage.getItem(FREE_DRAFT_KEY) ?? EMPTY_JAVA_BODY
  })
  const [structuredDraft, setStructuredDraft] = useState<StructuredDraft>(() => {
    if (typeof window === 'undefined') return createEmptyStructuredDraft()
    return restoreStructuredDraft(window.localStorage.getItem(STRUCTURED_DRAFT_KEY))
  })
  const [selectedMappingId, setSelectedMappingId] = useState(JAVA_MAPPING_ENTRIES[0].id)
  const [selectedCaseId, setSelectedCaseId] = useState(PUBLIC_CODE_PRACTICE_CASES[0].id)
  const [lastRun, setLastRun] = useState<CaseRun | null>(null)
  const [submission, setSubmission] = useState<SubmissionState | null>(null)
  const [draftSaved, setDraftSaved] = useState(true)
  const [referenceTab, setReferenceTab] = useState<'logic' | 'dictionary'>('logic')
  const [mobilePane, setMobilePane] = useState<'reference' | 'editor'>('reference')
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null)
  const [revealedSlotIssue, setRevealedSlotIssue] = useState<StructuredSlotIssue | null>(null)
  const editorView = useRef<EditorView | null>(null)
  const slotFields = useRef<Partial<Record<StructuredSlotId, SlotField | null>>>({})
  const copyTimer = useRef<number | null>(null)

  const structuredComposition = useMemo(() => composeStructuredBody(structuredDraft), [structuredDraft])
  const structuredValidation = useMemo(
    () => validateStructuredDraft(structuredDraft, structuredComposition),
    [structuredDraft, structuredComposition],
  )
  const activeCode = mode === 'structured' ? structuredComposition.source : freeCode
  const logicProgress = useMemo(() => analyzeLogicStepProgress(activeCode), [activeCode])
  const parseState = useMemo<ParseState>(() => {
    if (mode === 'structured') {
      if (structuredValidation.kind === 'invalid') {
        if (structuredValidation.issue.kind === 'required' && !revealedSlotIssue) {
          return { kind: 'empty' }
        }
        return {
          kind: 'invalid',
          message: structuredValidation.issue.message,
          diagnostic: structuredValidation.issue.diagnostic,
          slotIssue: structuredValidation.issue,
        }
      }
      return { kind: 'valid' }
    }
    if (!freeCode.trim()) return { kind: 'empty' }
    try {
      parseJavaSubset(freeCode)
      return { kind: 'valid' }
    } catch (error) {
      const diagnostic = diagnosticFrom(error)
      return { kind: 'invalid', message: diagnostic.message, diagnostic }
    }
  }, [freeCode, mode, revealedSlotIssue, structuredValidation])
  const selectedMapping = JAVA_MAPPING_ENTRIES.find((entry) => entry.id === selectedMappingId) ?? JAVA_MAPPING_ENTRIES[0]
  const selectedCase = PUBLIC_CODE_PRACTICE_CASES.find((testCase) => testCase.id === selectedCaseId) ?? PUBLIC_CODE_PRACTICE_CASES[0]
  const writtenStepCount = [...logicProgress.values()].filter(Boolean).length

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(FREE_DRAFT_KEY, freeCode)
      if (mode === 'free') setDraftSaved(true)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [freeCode, mode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STRUCTURED_DRAFT_KEY, JSON.stringify(structuredDraft))
      if (mode === 'structured') setDraftSaved(true)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [mode, structuredDraft])

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
  }, [])

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

  const focusSlot = (slotId: StructuredSlotId) => {
    const field = slotFields.current[slotId]
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field?.focus()
  }

  const focusDiagnostic = (diagnostic: JavaDiagnostic) => {
    if (mode === 'structured') {
      focusSlot(slotForDiagnostic(structuredComposition, diagnostic))
      return
    }
    focusLine(diagnostic.line)
  }

  const changeMode = (nextMode: PracticeMode) => {
    setMode(nextMode)
    setDraftSaved(true)
    setLastRun(null)
    setSubmission(null)
    setRevealedSlotIssue(null)
  }

  const changeStructuredSlot = (slotId: StructuredSlotId, value: string) => {
    setStructuredDraft((current) => ({ ...current, [slotId]: value }))
    setRevealedSlotIssue((current) => current?.slotId === slotId ? null : current)
    setDraftSaved(false)
    setLastRun(null)
    setSubmission(null)
  }

  const selectMapping = (entry: CodeMappingEntry) => {
    setSelectedMappingId(entry.id)
  }

  const copyStep = async (step: LogicCodeStep) => {
    await copyText(step.code)
    setCopiedStepId(step.id)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopiedStepId(null), 1300)
  }

  const runCase = (testCase: CodePracticeCase) => {
    if (mode === 'structured' && structuredValidation.kind === 'invalid') {
      setRevealedSlotIssue(structuredValidation.issue)
      focusSlot(structuredValidation.issue.slotId)
      return
    }
    const result = runJavaSubset(activeCode, testCase.input, testCase.expected)
    setSelectedCaseId(testCase.id)
    setLastRun({ testCase, result })
    setSubmission(null)
    if (result.diagnostic && result.diagnostic.line > 0) focusDiagnostic(result.diagnostic)
  }

  const submitAll = () => {
    if (mode === 'structured' && structuredValidation.kind === 'invalid') {
      setRevealedSlotIssue(structuredValidation.issue)
      focusSlot(structuredValidation.issue.slotId)
      return
    }
    const runs = CODE_PRACTICE_CASES.map((testCase) => ({
      testCase,
      result: runJavaSubset(activeCode, testCase.input, testCase.expected),
    }))
    const firstFailure = runs.find(({ result }) => !result.ok) ?? null
    setSubmission({
      passed: firstFailure === null,
      passedCount: runs.filter(({ result }) => result.ok).length,
      total: runs.length,
      firstFailure,
    })
    if (firstFailure) {
      if (firstFailure.testCase.visibility === '公开') {
        setSelectedCaseId(firstFailure.testCase.id)
        setLastRun(firstFailure)
        if (firstFailure.result.diagnostic) focusDiagnostic(firstFailure.result.diagnostic)
      } else {
        setLastRun(null)
      }
    } else {
      setLastRun(runs[0])
    }
  }

  const resetCode = () => {
    if (mode === 'structured') {
      setStructuredDraft(createEmptyStructuredDraft())
      window.localStorage.removeItem(STRUCTURED_DRAFT_KEY)
    } else {
      setFreeCode(EMPTY_JAVA_BODY)
      window.localStorage.removeItem(FREE_DRAFT_KEY)
    }
    setLastRun(null)
    setSubmission(null)
    setRevealedSlotIssue(null)
    setDraftSaved(false)
  }

  const activeSlotIssue = parseState.kind === 'invalid' ? parseState.slotIssue : undefined
  const categoryGroups = entriesByCategory(JAVA_MAPPING_ENTRIES)

  return (
    <div className="code-practice-shell page-enter">
      <header className="code-practice-header">
        <div className="code-practice-title">
          <span className="code-practice-mark" aria-hidden="true"><Code2 size={20} /></span>
          <div>
            <p className="eyebrow">代码实战 · Java</p>
            <h1>把刚才的动作写下来</h1>
          </div>
        </div>
        <div className="code-practice-header-actions">
          <span className="code-draft-status" role="status">
            <span className={draftSaved ? 'is-saved' : ''} />
            {draftSaved ? `${mode === 'structured' ? '结构' : '自由'}草稿已保存` : '正在保存'}
          </span>
          <button type="button" className="quiet-command" onClick={onBack}>
            <ArrowLeft size={17} />
            返回技能调试
          </button>
        </div>
      </header>

      <nav className="mobile-practice-switch" aria-label="代码实战视图">
        <button
          type="button"
          className={mobilePane === 'reference' ? 'is-active' : ''}
          aria-pressed={mobilePane === 'reference'}
          onClick={() => setMobilePane('reference')}
        >
          <BookOpen size={16} />
          参考
        </button>
        <button
          type="button"
          className={mobilePane === 'editor' ? 'is-active' : ''}
          aria-pressed={mobilePane === 'editor'}
          onClick={() => setMobilePane('editor')}
        >
          <PencilLine size={16} />
          编辑
        </button>
      </nav>

      <main className={`code-practice-workbench mobile-pane-${mobilePane}`}>
        <aside className="code-mapping-panel" aria-label="代码参考">
          <div className="reference-heading">
            <div>
              <p className="panel-kicker">世界动作 → Java</p>
              <h2>{referenceTab === 'logic' ? '完整逻辑代码' : '代码词典'}</h2>
            </div>
            {referenceTab === 'logic' && (
              <span className="logic-progress" aria-label={`已写入 ${writtenStepCount} 段，共 ${JAVA_LOGIC_REFERENCE.steps.length} 段`}>
                {writtenStepCount}/{JAVA_LOGIC_REFERENCE.steps.length}
              </span>
            )}
          </div>

          <div className="reference-tabs" role="tablist" aria-label="代码参考类型">
            <button
              type="button"
              role="tab"
              aria-selected={referenceTab === 'logic'}
              className={referenceTab === 'logic' ? 'is-active' : ''}
              onClick={() => setReferenceTab('logic')}
            >
              <ListTree size={15} />
              逻辑代码
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={referenceTab === 'dictionary'}
              className={referenceTab === 'dictionary' ? 'is-active' : ''}
              onClick={() => setReferenceTab('dictionary')}
            >
              <BookOpen size={15} />
              代码词典
            </button>
          </div>

          {referenceTab === 'logic' ? (
            <div className="logic-reference-panel" role="tabpanel">
              <p className="mapping-intro">这条轨道与刚才通过验证的技能树顺序一致。</p>
              <div className="logic-translation-track">
                {JAVA_LOGIC_REFERENCE.steps.map((step) => {
                  const written = logicProgress.get(step.id) ?? false
                  const copied = copiedStepId === step.id
                  return (
                    <article
                      key={step.id}
                      className={`logic-reference-step depth-${step.depth} tone-${step.tone}`}
                      data-step-id={step.id}
                      data-skill-type={step.skillType}
                      data-scope-depth={step.depth}
                      data-structured-slots={step.structuredSlotIds.join(',')}
                      data-locked-structure={step.lockedStructure}
                    >
                      <span className="logic-track-node" aria-hidden="true">{step.order}</span>
                      <div className="logic-step-content">
                        <div className="logic-step-heading">
                          <span>{step.skillLabel}</span>
                          <small className={written ? 'is-written' : step.lockedStructure && mode === 'structured' ? 'is-locked' : ''}>
                            {written ? <Check size={12} /> : null}
                            {written ? '语义已识别' : step.lockedStructure && mode === 'structured' ? '结构已锁定' : '待填写'}
                          </small>
                        </div>
                        <strong>{step.worldAction}</strong>
                        <p>{step.logicPurpose}</p>
                        <div className="logic-code-fragment">
                          <pre><code>{step.code}</code></pre>
                          <button
                            type="button"
                            className={copied ? 'is-copied' : ''}
                            onClick={() => void copyStep(step)}
                            aria-label={`复制代码段：${step.skillLabel}`}
                            title={`复制代码段：${step.skillLabel}`}
                          >
                            {copied ? <Check size={15} /> : <Copy size={15} />}
                            <span>{copied ? '已复制' : '复制'}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="dictionary-panel" role="tabpanel">
              <p className="mapping-intro">按概念查阅货位、变量、语法和本关允许的 API。</p>
              <div className="mapping-groups">
                {categoryGroups.map(({ category, entries }) => (
                  <section key={category} className="mapping-group" aria-label={MAPPING_CATEGORY_LABELS[category]}>
                    <h3>{MAPPING_CATEGORY_LABELS[category]}</h3>
                    <div className="mapping-entry-list">
                      {entries.map((entry) => {
                        const active = entry.id === selectedMapping.id
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            className={`mapping-entry ${active ? 'is-selected' : ''}`}
                            aria-pressed={active}
                            onClick={() => selectMapping(entry)}
                          >
                            <span className="mapping-entry-copy"><strong>{entry.label}</strong></span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <div className="mapping-detail" aria-live="polite">
                <div className="mapping-detail-heading">
                  <span className="mapping-detail-icon"><Sparkles size={15} /></span>
                  <strong>{selectedMapping.label}</strong>
                </div>
                <p>{selectedMapping.description}</p>
                <code>{selectedMapping.snippets[0]?.code}</code>
              </div>
            </div>
          )}
        </aside>

        <section className="code-editor-panel" aria-label="Java 代码编辑器">
          <div className="code-editor-heading">
            <div>
              <p className="panel-kicker">右侧编辑</p>
              <h2><FileCode2 size={18} /> Java 代码</h2>
            </div>
            <div className="code-editor-tools">
              <div className="code-mode-switch" role="radiogroup" aria-label="代码填写方式">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'structured'}
                  className={mode === 'structured' ? 'is-active' : ''}
                  onClick={() => changeMode('structured')}
                >
                  <ListTree size={14} />
                  结构填写
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'free'}
                  className={mode === 'free' ? 'is-active' : ''}
                  onClick={() => changeMode('free')}
                >
                  <PencilLine size={14} />
                  自由编写
                </button>
              </div>
              <span className="sandbox-chip">受限语义沙盒</span>
            </div>
          </div>

          {mode === 'structured' ? (
            <StructuredEditor
              draft={structuredDraft}
              issue={activeSlotIssue}
              onChange={changeStructuredSlot}
              onFieldRef={(slotId, field) => { slotFields.current[slotId] = field }}
            />
          ) : (
            <div className="code-editor-frame">
              <div className="code-method-signature">void moveZeroes(int[] nums) {'{'}</div>
              <div className="code-method-body">
                <CodeMirror
                  value={freeCode}
                  height="520px"
                  theme={editorTheme}
                  extensions={[java()]}
                  onCreateEditor={(view) => { editorView.current = view }}
                  onChange={(value) => {
                    setFreeCode(value)
                    setDraftSaved(false)
                    setLastRun(null)
                    setSubmission(null)
                  }}
                  basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                  aria-label="Java 方法体编辑器"
                />
              </div>
              <div className="code-method-signature code-method-close">{'}'}</div>
            </div>
          )}

          <div className={`parse-status ${parseState.kind === 'valid' ? 'is-valid' : parseState.kind === 'empty' ? 'is-empty' : 'is-invalid'}`} role="status">
            {parseState.kind === 'valid' ? <Check size={16} /> : <CircleAlert size={16} />}
            <span>
              {parseState.kind === 'empty'
                ? mode === 'structured' ? '按顺序填写 7 个逻辑槽位，固定结构会自动保留' : '尚未开始编写'
                : parseState.kind === 'valid'
                  ? mode === 'structured' ? '结构与双指针逻辑已经连通' : '语法可以解析'
                  : `${parseState.slotIssue?.kind === 'required' ? '待填写' : parseState.slotIssue?.kind === 'semantic' ? '逻辑待调整' : diagnosticLabel[parseState.diagnostic?.kind ?? 'syntax']}：${parseState.message}`}
            </span>
            {parseState.kind === 'invalid' && (parseState.slotIssue || parseState.diagnostic) && (
              <button
                type="button"
                onClick={() => {
                  if (parseState.slotIssue) focusSlot(parseState.slotIssue.slotId)
                  else if (parseState.diagnostic) focusDiagnostic(parseState.diagnostic)
                }}
              >
                {parseState.slotIssue
                  ? `定位“${SLOT_DEFINITION_BY_ID[parseState.slotIssue.slotId].label}”`
                  : `定位第 ${parseState.diagnostic?.line ?? 1} 行`}
              </button>
            )}
          </div>

          <div className="code-action-bar">
            <label className="case-picker">
              <span>运行用例</span>
              <select value={selectedCase.id} onChange={(event) => setSelectedCaseId(event.target.value)}>
                {PUBLIC_CODE_PRACTICE_CASES.map((testCase) => (
                  <option key={testCase.id} value={testCase.id}>
                    {testCase.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="code-command primary" onClick={() => runCase(selectedCase)}>
              <Play size={17} fill="currentColor" />
              运行当前用例
            </button>
            <button type="button" className="code-command" onClick={submitAll}>
              <Send size={17} />
              提交全部用例
            </button>
            <button type="button" className="icon-button" onClick={resetCode} title="重置当前模式" aria-label="重置当前模式">
              <RotateCcw size={17} />
            </button>
          </div>

          <div className="code-test-strip">
            <span className="test-strip-label">当前输入</span>
            <code>{JSON.stringify(selectedCase.input)}</code>
            <span className="test-strip-arrow">→</span>
            <code>{JSON.stringify(selectedCase.expected)}</code>
            <span className="test-strip-label">{selectedCase.visibility}</span>
          </div>

          {lastRun && (
            <div className={`code-run-result ${lastRun.result.ok ? 'is-success' : 'is-failure'}`} role="status">
              <span className="code-result-icon">
                {lastRun.result.ok ? <Check size={18} /> : <AlertTriangle size={18} />}
              </span>
              <div>
                <strong>{lastRun.result.ok ? '用例通过' : diagnosticLabel[lastRun.result.kind as JavaDiagnostic['kind']]}</strong>
                <p>{lastRun.result.message}</p>
                {!lastRun.result.ok && lastRun.result.values && (
                  <small>得到 {JSON.stringify(lastRun.result.values)}，目标 {JSON.stringify(lastRun.result.expected)}</small>
                )}
              </div>
              {lastRun.result.diagnostic && (
                <button type="button" onClick={() => focusDiagnostic(lastRun.result.diagnostic!)}>
                  {mode === 'structured' ? '定位对应填空' : `第 ${lastRun.result.diagnostic.line} 行`}
                </button>
              )}
            </div>
          )}

          {submission && (
            <div className={`submission-result ${submission.passed ? 'is-success' : 'is-failure'}`} role="status">
              {submission.passed ? <Check size={20} /> : <CircleAlert size={20} />}
              <div>
                <strong>{submission.passed ? '全部用例通过' : '还有用例没有通过'}</strong>
                <span>
                  {submission.passedCount} / {submission.total} 个用例通过
                  {!submission.passed && submission.firstFailure?.testCase.visibility === '隐藏' ? ' · 隐藏用例未通过' : ''}
                </span>
              </div>
              {!submission.passed && submission.firstFailure?.testCase.visibility === '公开' && (
                <button type="button" onClick={() => {
                  const diagnostic = submission.firstFailure?.result.diagnostic
                  if (diagnostic) focusDiagnostic(diagnostic)
                }}>
                  查看首个失败
                </button>
              )}
            </div>
          )}

          <div className="code-support-note">
            <CircleAlert size={15} />
            <span>当前沙盒只执行变量、数组、for、if、赋值、交换和自增；其他 Java 语法会明确标记为暂不支持。</span>
          </div>
        </section>
      </main>
    </div>
  )
}

export { JAVA_MAPPING }
