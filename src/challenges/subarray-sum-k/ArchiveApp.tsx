import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Braces,
  Check,
  ChevronRight,
  CircleAlert,
  Code2,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  StepForward,
} from 'lucide-react'
import ArchiveBoard from './ArchiveBoard'
import ArchiveProgramBuilder from './ArchiveProgramBuilder'
import ArchiveSkillIntro from './ArchiveSkillIntro'
import { SUBARRAY_SUM_K_CHALLENGE } from './challenge'
import { ARCHIVE_BATCHES } from './cases'
import {
  interpretArchiveProgram,
  type ArchiveTraceFrame,
} from './interpreter'
import type { ArchiveSkillNode, ArchiveSkillType } from './model'
import { checkArchiveBatches, type ArchiveSuiteCheck } from './suiteValidation'

const CodePractice = lazy(() => import('../../components/CodePractice')) as unknown as typeof import('../../components/CodePractice').default

type Stage = 'manual' | 'program' | 'code'

interface ArchiveAppProps {
  onExit?: () => void
}

const STAGE_LABELS = ['动手理解', '技能认识', '规则编排', '调试执行', '多批验证', '代码实战']

const blankFrame = (values: number[], target: number, message = '前缀档案站等待执行。'): ArchiveTraceFrame => ({
  id: 0,
  values: [...values],
  target,
  currentIndex: null,
  currentValue: null,
  prefix: 0,
  needed: null,
  answer: 0,
  matchedCount: 0,
  frequencyEntries: [],
  changedKey: null,
  activeNodeId: null,
  message,
  status: 'idle',
})

const rangeSum = (values: number[], start: number, end: number) =>
  values.slice(start, end + 1).reduce((sum, value) => sum + value, 0)

export default function ArchiveApp({ onExit }: ArchiveAppProps) {
  const directCode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('stage') === 'code'
  const [stage, setStage] = useState<Stage>(directCode ? 'code' : 'manual')
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [foundRanges, setFoundRanges] = useState<Set<string>>(new Set())
  const [manualMessage, setManualMessage] = useState('先选择连续区间的起点，再选择终点。')
  const [program, setProgram] = useState<ArchiveSkillNode[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [passedBatches, setPassedBatches] = useState<Set<number>>(new Set())
  const [suiteCheck, setSuiteCheck] = useState<ArchiveSuiteCheck | null>(null)
  const [frames, setFrames] = useState<ArchiveTraceFrame[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [introSkill, setIntroSkill] = useState<ArchiveSkillType | null>(null)

  const observeValues = SUBARRAY_SUM_K_CHALLENGE.scene.observeValues
  const observeTarget = SUBARRAY_SUM_K_CHALLENGE.scene.observeTarget
  const manualComplete = foundRanges.size === 2
  const currentBatch = ARCHIVE_BATCHES[batchIndex]
  const currentFrame = frames[frameIndex] ?? blankFrame(currentBatch.values, currentBatch.target)
  const runComplete = frames.length > 0 && frameIndex === frames.length - 1
  const currentPassed = runComplete && currentFrame.status === 'success'
  const allPassed = passedBatches.size === ARCHIVE_BATCHES.length
  const runtimeLocked = frames.length > 0 && !runComplete
  const firstFailedIndex = suiteCheck?.failedIndices[0] ?? -1
  const firstFailedCheck = firstFailedIndex >= 0
    ? suiteCheck?.batches.find(({ batchIndex: checkedIndex }) => checkedIndex === firstFailedIndex)
    : null

  const activeStageIndex = stage === 'manual'
    ? 0
    : stage === 'code'
      ? 5
      : allPassed || suiteCheck
        ? 4
        : frames.length > 0
          ? 3
          : program.length > 0
            ? 2
            : 1

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
    }, 480)
    return () => window.clearInterval(timer)
  }, [frames.length, playing])

  useEffect(() => {
    if (!currentPassed) return
    setPassedBatches((current) => current.has(batchIndex)
      ? current
      : new Set([...current, batchIndex]))
  }, [batchIndex, currentPassed])

  const manualFrame = useMemo(
    () => blankFrame(observeValues, observeTarget, manualMessage),
    [manualMessage, observeTarget, observeValues],
  )

  const selectManualIndex = (index: number) => {
    if (manualComplete) return
    if (selectionStart === null) {
      setSelectionStart(index)
      setManualMessage(`已选 ${index} 号站作为起点，请选择终点。`)
      return
    }
    const start = Math.min(selectionStart, index)
    const end = Math.max(selectionStart, index)
    const sum = rangeSum(observeValues, start, end)
    const key = `${start}:${end}`
    setSelectionStart(null)
    if (sum !== observeTarget) {
      setManualMessage(`${start} 到 ${end} 号站的总和是 ${sum}，还不是目标 ${observeTarget}。`)
      return
    }
    setFoundRanges((current) => new Set([...current, key]))
    setManualMessage(foundRanges.has(key)
      ? '这个区间已经归档，请找另一个连续区间。'
      : foundRanges.size === 1
        ? '两个目标区间都已找到，可以进入档案技能台。'
        : '已找到一个目标区间，再找一个。')
  }

  const resetRuntime = () => {
    setPlaying(false)
    setFrames([])
    setFrameIndex(0)
  }

  const invalidateVerification = (nextProgram: ArchiveSkillNode[]) => {
    setProgram(nextProgram)
    resetRuntime()
    setPassedBatches(new Set())
    setSuiteCheck(null)
  }

  const runCurrentBatch = () => {
    if (program.length === 0 || runtimeLocked) return
    const result = interpretArchiveProgram(program, currentBatch.values, currentBatch.target)
    setSuiteCheck(null)
    setFrames(result.frames)
    setFrameIndex(0)
    setPlaying(result.frames.length > 1)
  }

  const verifyAll = () => {
    if (program.length === 0 || runtimeLocked) return
    const result = checkArchiveBatches(program, ARCHIVE_BATCHES)
    setPlaying(false)
    setSuiteCheck(result)
    setPassedBatches(new Set(result.passedIndices))
    if (result.passed) {
      const final = result.batches.at(-1)?.result.frames ?? []
      setBatchIndex(ARCHIVE_BATCHES.length - 1)
      setFrames(final)
      setFrameIndex(Math.max(final.length - 1, 0))
    }
  }

  const inspectFailedBatch = () => {
    if (!firstFailedCheck) return
    setBatchIndex(firstFailedCheck.batchIndex)
    setFrames(firstFailedCheck.result.frames)
    setFrameIndex(0)
    setPlaying(false)
  }

  const chooseStage = (index: number) => {
    if (index === 0) setStage('manual')
    else if (index === 5 && (allPassed || directCode)) setStage('code')
    else if (index > 0 && index < 5 && manualComplete) setStage('program')
  }

  if (stage === 'code') {
    return (
      <Suspense fallback={<div className="archive-loading">正在打开 Java 档案台…</div>}>
        <CodePractice
          challenge={SUBARRAY_SUM_K_CHALLENGE}
          onBack={() => setStage('program')}
          onExit={onExit}
        />
      </Suspense>
    )
  }

  return (
    <div className="archive-app">
      <header className="archive-topbar">
        <a href="/" className="archive-brand" aria-label="返回技能编程挑战目录">
          <span><Braces size={21} /></span>
          <div><strong>前缀和档案站</strong><small>和为 K 的子数组</small></div>
        </a>
        <nav aria-label="关卡阶段">
          {STAGE_LABELS.map((label, index) => (
            <button
              type="button"
              key={label}
              className={`${activeStageIndex === index ? 'is-active' : ''} ${index < activeStageIndex ? 'is-complete' : ''}`}
              onClick={() => chooseStage(index)}
              disabled={(index > 0 && index < 5 && !manualComplete) || (index === 5 && !allPassed && !directCode)}
              aria-current={activeStageIndex === index ? 'step' : undefined}
            >
              <span>{index < activeStageIndex ? <Check size={12} /> : String(index + 1).padStart(2, '0')}</span>
              {label}
            </button>
          ))}
        </nav>
        {onExit && <button type="button" className="archive-exit" onClick={onExit}><LayoutGrid size={17} />挑战选择</button>}
      </header>

      {stage === 'manual' ? (
        <main className="archive-manual">
          <section className="archive-section-heading">
            <div><p>01 动手理解</p><h1>找出连续区间</h1></div>
            <span>{foundRanges.size} / 2 已归档</span>
          </section>
          <div className="archive-manual-workspace">
            <ArchiveBoard
              frame={manualFrame}
              selectable={!manualComplete}
              selectionStart={selectionStart}
              selectedRangeKeys={foundRanges}
              onSelectIndex={selectManualIndex}
              label="动手寻找和为 2 的连续子数组"
            />
            <aside className="archive-manual-panel">
              <p>目标区间</p>
              <h2>连续站点总和 = {observeTarget}</h2>
              <div className="archive-found-ranges">
                {[...foundRanges].map((key) => {
                  const [start, end] = key.split(':').map(Number)
                  return <span key={key}><Check size={15} />{start} — {end}<b>{rangeSum(observeValues, start, end)}</b></span>
                })}
                {foundRanges.size === 0 && <em>还没有归档区间</em>}
              </div>
              <button type="button" className="archive-primary" disabled={!manualComplete} onClick={() => setStage('program')}>
                进入档案技能台<ArrowRight size={17} />
              </button>
            </aside>
          </div>
        </main>
      ) : (
        <main className="archive-program">
          <section className="archive-section-heading archive-program-heading">
            <div><p>02—05 技能与验证</p><h1>编排前缀档案规则</h1></div>
            <span>{passedBatches.size} / {ARCHIVE_BATCHES.length} 批通过</span>
          </section>
          <div className="archive-workbench">
            <div className="archive-runtime-panel">
              <div className="archive-batch-tabs" role="tablist" aria-label="验证批次">
                {ARCHIVE_BATCHES.map((batch, index) => (
                  <button type="button" role="tab" aria-selected={batchIndex === index} key={batch.id} className={batchIndex === index ? 'is-active' : ''} onClick={() => { if (!runtimeLocked) { setBatchIndex(index); resetRuntime(); setSuiteCheck(null) } }}>
                    <span>{passedBatches.has(index) ? <Check size={13} /> : index + 1}</span>{batch.name.replace(/^第.卷 · /, '')}
                  </button>
                ))}
              </div>
              <ArchiveBoard frame={currentFrame} label={`${currentBatch.name}执行场景`} />
              <div className="archive-playback">
                <div className="archive-frame-counter"><span>执行帧</span><strong>{frames.length === 0 ? '—' : `${frameIndex + 1} / ${frames.length}`}</strong></div>
                <button type="button" className="archive-primary" disabled={program.length === 0 || runtimeLocked} onClick={() => playing ? setPlaying(false) : frames.length > 0 && !runComplete ? setPlaying(true) : runCurrentBatch()}>
                  {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}{playing ? '暂停' : frames.length > 0 && !runComplete ? '继续' : '运行当前批次'}
                </button>
                <button type="button" className="archive-icon-button" disabled={frames.length === 0 || playing || runComplete} onClick={() => setFrameIndex((current) => Math.min(current + 1, frames.length - 1))} aria-label="单步执行" title="单步执行"><StepForward size={18} /></button>
                <button type="button" className="archive-icon-button" disabled={frames.length === 0} onClick={resetRuntime} aria-label="重置执行" title="重置执行"><RotateCcw size={18} /></button>
              </div>

              <section className="archive-verification">
                <header><div><p>05 多批验证</p><h2>验证这套规则能否泛化</h2></div><ShieldCheck size={21} /></header>
                {suiteCheck ? (
                  <div className={`archive-suite-result ${suiteCheck.passed ? 'is-success' : 'is-failure'}`}>
                    {suiteCheck.passed ? <Check size={18} /> : <CircleAlert size={18} />}
                    <div>
                      <strong>{suiteCheck.passed ? '全部批次通过' : `${suiteCheck.failedIndices.length} 个批次未通过`}</strong>
                      <p>{suiteCheck.passed ? '代码实战已经解锁。' : firstFailedCheck?.result.error ?? '查看首个失败批次继续调试。'}</p>
                    </div>
                    {!suiteCheck.passed && <button type="button" onClick={inspectFailedBatch}>查看第 {firstFailedIndex + 1} 批<ChevronRight size={15} /></button>}
                  </div>
                ) : (
                  <div className="archive-batch-status">
                    {ARCHIVE_BATCHES.map((batch, index) => <span key={batch.id} className={passedBatches.has(index) ? 'is-passed' : ''}><i>{passedBatches.has(index) ? <Check size={12} /> : index + 1}</i>{batch.expected} 个目标区间</span>)}
                  </div>
                )}
                <div className="archive-verification-actions">
                  <button type="button" disabled={program.length === 0 || runtimeLocked} onClick={verifyAll}><ShieldCheck size={17} />校验全部批次</button>
                  {(allPassed || suiteCheck?.passed) && <button type="button" onClick={() => { setPassedBatches(new Set()); setSuiteCheck(null); setBatchIndex(0); resetRuntime() }}><RotateCcw size={17} />重新验证</button>}
                  <button type="button" className="archive-primary" disabled={!allPassed} onClick={() => setStage('code')}>进入代码实战<Code2 size={17} /></button>
                </div>
              </section>
            </div>

            <ArchiveProgramBuilder
              program={program}
              activeNodeId={currentFrame.activeNodeId}
              disabled={runtimeLocked || playing}
              onChange={invalidateVerification}
              onClear={() => invalidateVerification([])}
              onPreviewSkill={(type) => setIntroSkill(type)}
            />
          </div>
        </main>
      )}

      {introSkill && <ArchiveSkillIntro skillType={introSkill} onClose={() => setIntroSkill(null)} />}
      {stage === 'program' && currentPassed && batchIndex < ARCHIVE_BATCHES.length - 1 && (
        <button type="button" className="archive-next-batch" onClick={() => { setBatchIndex((index) => index + 1); resetRuntime() }}>
          下一批<SkipForward size={17} />
        </button>
      )}
    </div>
  )
}
