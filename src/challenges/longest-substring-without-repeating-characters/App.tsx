import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  CircleAlert,
  Code2,
  Eye,
  LayoutGrid,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  StepForward,
  Workflow,
} from 'lucide-react'
import CharacterCorridor from './components/CharacterCorridor'
import WindowProgramBuilder from './components/WindowProgramBuilder'
import WindowSkillIntro from './components/WindowSkillIntro'
import { WINDOW_BATCHES } from './cases'
import { LONGEST_SUBSTRING_CHALLENGE } from './challenge'
import { findLongestUniqueWindow, interpretWindowProgram } from './interpreter'
import {
  WINDOW_SKILLS,
  type WindowSkillNode,
  type WindowSkillType,
  type WindowTraceFrame,
} from './model'
import { checkWindowBatches, type WindowSuiteCheckResult } from './suiteValidation'
import './styles.css'

const CodePractice = lazy(() => import('../../components/CodePractice')) as unknown as typeof import('../../components/CodePractice').default

type Stage = 'manual' | 'skills' | 'program' | 'debug' | 'batch' | 'code'

interface CharacterCorridorAppProps {
  onExit?: () => void
}

const STAGES: Array<{ id: Stage; label: string }> = [
  { id: 'manual', label: '动手理解' },
  { id: 'skills', label: '技能认识' },
  { id: 'program', label: '规则编排' },
  { id: 'debug', label: '调试执行' },
  { id: 'batch', label: '多批验证' },
  { id: 'code', label: '代码实战' },
]

const blankFrame = (source: string, message = '字符灯廊等待一套可执行的窗口规则。'): WindowTraceFrame => ({
  id: 0,
  source,
  left: 0,
  right: 0,
  windowEnd: null,
  currentCode: null,
  frequencies: {},
  bestLength: 0,
  bestStart: null,
  bestEnd: null,
  changedIndex: null,
  changedCode: null,
  activeNodeId: null,
  message,
  status: 'idle',
})

const uniqueLength = (source: string, start: number, end: number) => {
  const characters = source.slice(start, end + 1)
  return new Set(characters).size === characters.length ? characters.length : 0
}

const countProgramNodes = (nodes: WindowSkillNode[]): number =>
  nodes.reduce((total, node) => total + 1 + countProgramNodes(node.children), 0)

export default function CharacterCorridorApp({ onExit }: CharacterCorridorAppProps) {
  const directCode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('stage') === 'code'
  const [stage, setStage] = useState<Stage>(directCode ? 'code' : 'manual')
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null)
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null)
  const [manualChecked, setManualChecked] = useState(false)
  const [previewedSkills, setPreviewedSkills] = useState<Set<WindowSkillType>>(new Set())
  const [introSkill, setIntroSkill] = useState<WindowSkillType | null>(null)
  const [program, setProgram] = useState<WindowSkillNode[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [passedBatches, setPassedBatches] = useState<Set<number>>(new Set())
  const [suiteCheck, setSuiteCheck] = useState<WindowSuiteCheckResult | null>(null)
  const [frames, setFrames] = useState<WindowTraceFrame[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const programNodeCount = useMemo(() => countProgramNodes(program), [program])

  const manualSource = LONGEST_SUBSTRING_CHALLENGE.scene.source
  const manualExpected = useMemo(() => findLongestUniqueWindow(manualSource), [manualSource])
  const selectedLength = selectionStart === null || selectionEnd === null
    ? 0
    : uniqueLength(manualSource, selectionStart, selectionEnd)
  const manualComplete = manualChecked && selectedLength === manualExpected.length
  const currentBatch = WINDOW_BATCHES[batchIndex]
  const currentFrame = frames[frameIndex] ?? blankFrame(currentBatch.source)
  const runComplete = frames.length > 0 && frameIndex === frames.length - 1
  const currentPassed = runComplete && currentFrame.status === 'success'
  const allPassed = passedBatches.size === WINDOW_BATCHES.length
  const runtimeLocked = frames.length > 0 && !runComplete
  const firstFailedIndex = suiteCheck?.failedIndices[0] ?? -1
  const firstFailedCheck = firstFailedIndex >= 0
    ? suiteCheck?.batches.find(({ batchIndex: checkedIndex }) => checkedIndex === firstFailedIndex)
    : null
  const manualFrame = useMemo(
    () => blankFrame(manualSource, '选择一段最长、连续且没有重复字符的窗口。'),
    [manualSource],
  )

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false)
          return current
        }
        const next = current + 1
        if (next >= frames.length - 1) setPlaying(false)
        return next
      })
    }, 430)
    return () => window.clearInterval(timer)
  }, [frames.length, playing])

  useEffect(() => {
    if (!currentPassed) return
    setPassedBatches((current) => current.has(batchIndex)
      ? current
      : new Set([...current, batchIndex]))
  }, [batchIndex, currentPassed])

  const resetRuntime = () => {
    setPlaying(false)
    setFrames([])
    setFrameIndex(0)
  }

  const updateProgram = (next: WindowSkillNode[]) => {
    setProgram(next)
    setBatchIndex(0)
    setPassedBatches(new Set())
    setSuiteCheck(null)
    resetRuntime()
  }

  const selectManualIndex = (index: number) => {
    if (selectionAnchor === null) {
      setSelectionAnchor(index)
      setSelectionStart(index)
      setSelectionEnd(index)
      setManualChecked(false)
      return
    }
    const start = Math.min(selectionAnchor, index)
    const end = Math.max(selectionAnchor, index)
    setSelectionStart(start)
    setSelectionEnd(end)
    setSelectionAnchor(null)
    setManualChecked(true)
  }

  const prepareRun = () => {
    setSuiteCheck(null)
    const result = interpretWindowProgram(program, currentBatch.source)
    setFrames(result.frames)
    setFrameIndex(0)
    return result.frames
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    const nextFrames = frames.length > 0 && !runComplete ? frames : prepareRun()
    if (nextFrames.length > 1) setPlaying(true)
  }

  const step = () => {
    setPlaying(false)
    if (frames.length === 0 || runComplete) {
      const nextFrames = prepareRun()
      setFrameIndex(Math.min(1, nextFrames.length - 1))
      return
    }
    setFrameIndex((current) => Math.min(current + 1, frames.length - 1))
  }

  const selectBatch = (index: number) => {
    if (runtimeLocked) return
    setBatchIndex(index)
    setSuiteCheck(null)
    resetRuntime()
  }

  const verifyAll = () => {
    if (program.length === 0 || runtimeLocked) return
    const result = checkWindowBatches(program, WINDOW_BATCHES)
    setPlaying(false)
    setSuiteCheck(result)
    setPassedBatches(new Set(result.passedIndices))
    if (result.passed) {
      const lastBatchIndex = WINDOW_BATCHES.length - 1
      const lastFrames = result.batches[lastBatchIndex]?.result.frames ?? []
      setBatchIndex(lastBatchIndex)
      setFrames(lastFrames)
      setFrameIndex(Math.max(lastFrames.length - 1, 0))
    } else {
      setBatchIndex(result.failedIndices[0] ?? 0)
      setFrames([])
      setFrameIndex(0)
    }
  }

  const inspectFailedBatch = () => {
    if (!firstFailedCheck) return
    setBatchIndex(firstFailedCheck.batchIndex)
    setFrames(firstFailedCheck.result.frames)
    setFrameIndex(0)
    setPlaying(false)
  }

  const resetSuite = () => {
    setBatchIndex(0)
    setPassedBatches(new Set())
    setSuiteCheck(null)
    resetRuntime()
  }

  const openCodePractice = () => {
    window.history.replaceState(null, '', '?stage=code')
    setStage('code')
  }

  const chooseStage = (next: Stage) => {
    if (next === 'manual') setStage(next)
    else if (next === 'skills' && manualComplete) setStage(next)
    else if (next === 'program' && manualComplete) setStage(next)
    else if (next === 'debug' && manualComplete && program.length > 0) setStage(next)
    else if (next === 'batch' && passedBatches.has(0)) setStage(next)
    else if (next === 'code' && (allPassed || directCode)) openCodePractice()
  }

  const stageEnabled = (candidate: Stage) => {
    if (candidate === 'manual') return true
    if (candidate === 'skills' || candidate === 'program') return manualComplete
    if (candidate === 'debug') return manualComplete && program.length > 0
    if (candidate === 'batch') return passedBatches.has(0)
    return allPassed || directCode
  }

  const stageCompleted = (candidate: Stage) => {
    if (candidate === 'manual') return manualComplete
    if (candidate === 'skills') return previewedSkills.size > 0 || stage !== 'skills' && stage !== 'manual'
    if (candidate === 'program') return program.length > 0
    if (candidate === 'debug') return passedBatches.has(0)
    if (candidate === 'batch') return allPassed
    return false
  }

  if (stage === 'code') {
    return (
      <main className="corridor-app corridor-code-stage">
        <Suspense fallback={<div className="corridor-loading" role="status">正在点亮 Java 代码台…</div>}>
          <CodePractice
            challenge={LONGEST_SUBSTRING_CHALLENGE}
            onBack={() => {
              window.history.replaceState(null, '', window.location.pathname)
              setStage('batch')
            }}
            onExit={onExit}
          />
        </Suspense>
      </main>
    )
  }

  return (
    <div className="corridor-app">
      <header className="corridor-topbar">
        <a href="/" className="corridor-brand" aria-label="返回技能编程挑战目录">
          <span><Braces size={21} /></span>
          <div><strong>字符灯廊</strong><small>无重复字符的最长子串</small></div>
        </a>
        <nav className="corridor-stage-nav" aria-label="关卡六阶段">
          {STAGES.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`${stage === item.id ? 'is-active' : ''} ${stageCompleted(item.id) ? 'is-complete' : ''}`}
              onClick={() => chooseStage(item.id)}
              disabled={!stageEnabled(item.id)}
              aria-current={stage === item.id ? 'step' : undefined}
            >
              <span>{stageCompleted(item.id) ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span>
              {item.label}
            </button>
          ))}
        </nav>
        {onExit && <button type="button" className="corridor-exit" onClick={onExit}><LayoutGrid size={17} />挑战选择</button>}
      </header>

      {stage === 'manual' && (
        <main className="corridor-manual">
          <section className="corridor-page-heading">
            <div><p>01 动手理解</p><h1>圈出最长无重复窗口</h1></div>
            <span>{manualComplete ? <><Check size={15} />观察完成</> : '两次点击确定连续区间'}</span>
          </section>
          <div className="corridor-manual-workspace">
            <CharacterCorridor
              frame={manualFrame}
              label="手动选择 abba 中的最长无重复窗口"
              manual={{
                anchor: selectionAnchor,
                start: selectionStart,
                end: selectionEnd,
                checked: manualChecked,
                correct: manualComplete,
              }}
              onSelectIndex={selectManualIndex}
            />
            <aside className="corridor-manual-panel">
              <p>窗口约束</p>
              <h2>连续，并且每个字符只亮一次</h2>
              <dl>
                <div><dt>当前选择</dt><dd>{selectionStart === null || selectionEnd === null ? '等待选择' : `${selectionStart} — ${selectionEnd}`}</dd></div>
                <div><dt>无重复长度</dt><dd>{selectedLength}</dd></div>
                <div><dt>最长目标</dt><dd>{manualExpected.length}</dd></div>
              </dl>
              <div className={`corridor-manual-status ${manualChecked ? (manualComplete ? 'is-success' : 'is-error') : ''}`} role="status">
                {!manualChecked && <><Eye size={18} /><span>{selectionAnchor === null ? '先选起点，再选终点。' : `起点是 ${selectionAnchor}，请选择终点。`}</span></>}
                {manualChecked && manualComplete && <><Check size={18} /><span>窗口长度达到 {manualExpected.length}，而且没有重复字符。</span></>}
                {manualChecked && !manualComplete && <><CircleAlert size={18} /><span>再选一次：重复字符会让有效长度归零，短窗口也不是最长。</span></>}
              </div>
              <div className="corridor-manual-actions">
                <button type="button" className="corridor-icon-button" onClick={() => { setSelectionAnchor(null); setSelectionStart(null); setSelectionEnd(null); setManualChecked(false) }} aria-label="重新选择窗口" title="重新选择"><RotateCcw size={17} /></button>
                <button type="button" className="corridor-primary" disabled={!manualComplete} onClick={() => setStage('skills')}>进入技能认识<ArrowRight size={17} /></button>
              </div>
            </aside>
          </div>
        </main>
      )}

      {stage === 'skills' && (
        <main className="corridor-skills-stage">
          <section className="corridor-page-heading">
            <div><p>02 技能认识</p><h1>记住五步滑动窗口逻辑</h1></div>
            <span>{previewedSkills.size} / {WINDOW_SKILLS.length} 已预演</span>
          </section>
          <div className="corridor-skills-layout">
            <section className="corridor-skill-map" aria-label="窗口技能因果顺序">
              {WINDOW_SKILLS.map((skill, index) => (
                <button
                  type="button"
                  key={skill.type}
                  className={`tone-${skill.tone} ${previewedSkills.has(skill.type) ? 'is-previewed' : ''}`}
                  onClick={() => setIntroSkill(skill.type)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{skill.label}</strong><small>{skill.description}</small></div>
                  {previewedSkills.has(skill.type) ? <Check size={17} /> : <PlayCircle size={17} />}
                </button>
              ))}
            </section>
            <aside className="corridor-strategy-panel">
              <p>策略核心</p>
              <h2>右侧负责探索，左侧负责恢复唯一性</h2>
              <div className="corridor-strategy-chain" aria-label="滑动窗口核心因果链">
                <span>读取当前字符</span><i />
                <span>重复则持续收缩</span><i />
                <span>纳入并更新最长</span>
              </div>
              <button type="button" className="corridor-primary" onClick={() => setStage('program')}>从空程序开始<Workflow size={17} /></button>
            </aside>
          </div>
        </main>
      )}

      {(stage === 'program' || stage === 'debug' || stage === 'batch') && (
        <main className="corridor-program-stage">
          <section className="corridor-page-heading corridor-program-heading">
            <div>
              <p>{stage === 'program' ? '03 规则编排' : stage === 'debug' ? '04 调试执行' : '05 多批验证'}</p>
              <h1>{stage === 'program' ? '从空白编排窗口规则' : stage === 'debug' ? '逐帧观察边界变化' : '让同一套规则通过三条字符带'}</h1>
            </div>
            <span>{passedBatches.size} / {WINDOW_BATCHES.length} 批通过</span>
          </section>

          <div className="corridor-workbench">
            <section className="corridor-runtime-panel">
              {stage === 'batch' && (
                <div className="corridor-batch-tabs" role="tablist" aria-label="验证批次">
                  {WINDOW_BATCHES.map((batch, index) => (
                    <button type="button" role="tab" aria-selected={batchIndex === index} key={batch.id} className={`${batchIndex === index ? 'is-active' : ''} ${passedBatches.has(index) ? 'is-passed' : ''} ${suiteCheck?.failedIndices.includes(index) ? 'is-failed' : ''}`} onClick={() => selectBatch(index)} disabled={runtimeLocked}>
                      <span>{passedBatches.has(index) ? <Check size={12} /> : index + 1}</span>{batch.name}
                    </button>
                  ))}
                </div>
              )}

              <CharacterCorridor frame={currentFrame} label={`${currentBatch.name}滑动窗口执行场景`} />

              <div className={`corridor-runtime-message tone-${currentFrame.status}`} role="status">
                {currentFrame.status === 'success' ? <Check size={18} /> : currentFrame.status === 'error' ? <CircleAlert size={18} /> : <Eye size={18} />}
                <p>{currentFrame.message}</p>
                <strong>{currentFrame.bestLength} 字符</strong>
              </div>

              {stage === 'program' ? (
                <div className="corridor-stage-command">
                  <div><strong>程序节点 {programNodeCount}</strong><span>执行会真实检查作用域、顺序和窗口结果。</span></div>
                  <button type="button" className="corridor-primary" disabled={program.length === 0} onClick={() => setStage('debug')}>进入调试执行<ChevronRight size={17} /></button>
                </div>
              ) : (
                <div className="corridor-playback" aria-label="执行控制">
                  <button type="button" className="corridor-primary" onClick={togglePlay} disabled={program.length === 0 || allPassed}>
                    {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}{playing ? '暂停' : frames.length > 0 && !runComplete ? '继续播放' : '运行当前批次'}
                  </button>
                  <button type="button" className="corridor-icon-button" onClick={step} disabled={program.length === 0 || playing || allPassed} aria-label="单步执行" title="单步执行"><StepForward size={18} /></button>
                  <button type="button" className="corridor-icon-button" onClick={resetRuntime} disabled={frames.length === 0} aria-label="重置当前执行" title="重置当前执行"><RotateCcw size={18} /></button>
                  <span className="corridor-frame-count">{frames.length === 0 ? '待命' : `${frameIndex + 1} / ${frames.length}`}</span>
                  {stage === 'debug' && currentPassed && <button type="button" className="corridor-secondary" onClick={() => setStage('batch')}>进入多批验证<ShieldCheck size={17} /></button>}
                  {stage === 'batch' && currentPassed && batchIndex < WINDOW_BATCHES.length - 1 && !suiteCheck && <button type="button" className="corridor-secondary" onClick={() => selectBatch(batchIndex + 1)}>下一批<ChevronRight size={17} /></button>}
                </div>
              )}

              {stage === 'batch' && (
                <section className="corridor-verification">
                  <header><div><p>批次校准台</p><h2>当前规则的泛化结果</h2></div><ShieldCheck size={21} /></header>
                  {suiteCheck ? (
                    <div className={`corridor-suite-result ${suiteCheck.passed ? 'is-success' : 'is-failure'}`}>
                      {suiteCheck.passed ? <Check size={19} /> : <CircleAlert size={19} />}
                      <div>
                        <strong>{suiteCheck.passed ? '全部字符带通过' : `${suiteCheck.failedIndices.length} 个批次未通过`}</strong>
                        <p>{suiteCheck.passed ? '同一套窗口规则保持了每一条字符带的唯一性。' : firstFailedCheck?.result.error ?? '查看首个失败批次继续调试。'}</p>
                      </div>
                      {!suiteCheck.passed && <button type="button" onClick={inspectFailedBatch}><PlayCircle size={16} />查看第 {firstFailedIndex + 1} 批执行</button>}
                    </div>
                  ) : (
                    <div className="corridor-batch-status">
                      {WINDOW_BATCHES.map((batch, index) => <span key={batch.id} className={passedBatches.has(index) ? 'is-passed' : ''}><i>{passedBatches.has(index) ? <Check size={12} /> : index + 1}</i><b>{batch.expectedLength}</b> 个字符</span>)}
                    </div>
                  )}
                  <div className="corridor-verification-actions">
                    <button type="button" onClick={verifyAll} disabled={program.length === 0 || runtimeLocked || allPassed}><ShieldCheck size={17} />校验全部批次</button>
                    {allPassed && <button type="button" onClick={resetSuite}><RotateCcw size={17} />重新验证</button>}
                    <button type="button" className="corridor-primary" onClick={openCodePractice} disabled={!allPassed}>进入代码实战<Code2 size={17} /></button>
                  </div>
                </section>
              )}
            </section>

            <WindowProgramBuilder
              program={program}
              activeNodeId={currentFrame.activeNodeId}
              disabled={runtimeLocked || playing}
              onChange={updateProgram}
              onClear={() => updateProgram([])}
              onPreviewSkill={setIntroSkill}
            />
          </div>
        </main>
      )}

      {introSkill && (
        <WindowSkillIntro
          skillType={introSkill}
          onClose={() => setIntroSkill(null)}
          onPreviewed={(type) => setPreviewedSkills((current) => new Set([...current, type]))}
        />
      )}

      {stage !== 'manual' && (
        <button type="button" className="corridor-back-command" onClick={() => setStage(stage === 'skills' ? 'manual' : stage === 'program' ? 'skills' : stage === 'debug' ? 'program' : 'debug')}>
          <ArrowLeft size={16} />返回上一阶段
        </button>
      )}
    </div>
  )
}
