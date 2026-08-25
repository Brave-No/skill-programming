import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  CircleAlert,
  CircleStop,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Warehouse,
} from 'lucide-react'
import { ManualStage } from '../components/ManualStage'
import { WarehouseBoard, type WarehousePreview, type WarehousePreviewType } from '../components/WarehouseBoard'
import { BATCHES, type InterpretationResult } from '../game/model'
import { validateSkillProgram } from './contracts'
import { interpretSkillProgram } from './interpreter'
import { findInvocation, type SkillInvocation } from './model'
import { ProgramBuilderV2 } from './ProgramBuilderV2'
import { checkAllBatches, type SuiteCheckResult } from './suiteValidation'
import { CodePracticeV2 } from './codePractice/CodePracticeV2'

type Phase = 'manual' | 'program' | 'code'
type Playback = 'idle' | 'playing' | 'paused'

export function AppV2() {
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stage') === 'code') {
      return 'code'
    }
    return 'manual'
  })
  const [program, setProgram] = useState<SkillInvocation[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [completedBatches, setCompletedBatches] = useState<number[]>([])
  const [suiteCheck, setSuiteCheck] = useState<SuiteCheckResult | null>(null)
  const [result, setResult] = useState<InterpretationResult | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [playback, setPlayback] = useState<Playback>('idle')
  const [preview, setPreview] = useState<WarehousePreview | null>(null)

  const validation = useMemo(() => validateSkillProgram(program), [program])
  const batch = BATCHES[batchIndex]
  const frame = result?.frames[frameIndex]
  const isAtEnd = Boolean(result && frameIndex === result.frames.length - 1)
  const runtimeLocked = Boolean(result && !isAtEnd)
  const batchPassed = completedBatches.includes(batchIndex)
  const allPassed = completedBatches.length === BATCHES.length
  const canExecute = validation.valid && !allPassed && !batchPassed
  const failedBatches = suiteCheck?.failedIndices ?? []

  useEffect(() => {
    if (playback !== 'playing' || !result) return
    if (frameIndex >= result.frames.length - 1) {
      setPlayback('idle')
      return
    }
    const timer = window.setTimeout(() => {
      setFrameIndex((current) => Math.min(current + 1, result.frames.length - 1))
    }, 720)
    return () => window.clearTimeout(timer)
  }, [frameIndex, playback, result])

  useEffect(() => {
    if (!result || frameIndex !== result.frames.length - 1 || !result.success) return
    setCompletedBatches((current) =>
      current.includes(batchIndex) ? current : [...current, batchIndex],
    )
  }, [batchIndex, frameIndex, result])

  useEffect(() => {
    if (!preview) return
    const timer = window.setTimeout(() => setPreview(null), 1500)
    return () => window.clearTimeout(timer)
  }, [preview])

  const currentValues = frame?.values ?? batch.input
  const currentMessage = frame?.message ?? '机器人待命，等待一套可执行的规则。'
  const currentStatus = frame?.status ?? 'idle'
  const activeInstanceId = frame?.activeBlockId ?? null
  const activeAction = activeInstanceId
    ? findInvocation(program, activeInstanceId)?.skillType ?? null
    : null
  const progressLabel = useMemo(
    () => `${Math.min(frameIndex + 1, result?.frames.length ?? 1)} / ${result?.frames.length ?? 1}`,
    [frameIndex, result],
  )

  const startRun = () => {
    if (!validation.valid) return
    setPreview(null)
    if (result && !isAtEnd) {
      setPlayback('playing')
      return
    }
    setSuiteCheck(null)
    const nextResult = interpretSkillProgram(program, batch.input)
    setResult(nextResult)
    setFrameIndex(0)
    setPlayback('playing')
  }

  const pauseRun = () => setPlayback('paused')

  const stepRun = () => {
    if (!validation.valid) return
    setPreview(null)
    if (!result || isAtEnd) {
      setSuiteCheck(null)
      const nextResult = interpretSkillProgram(program, batch.input)
      setResult(nextResult)
      setFrameIndex(Math.min(1, nextResult.frames.length - 1))
    } else {
      setFrameIndex((current) => Math.min(current + 1, result.frames.length - 1))
    }
    setPlayback('paused')
  }

  const resetRun = () => {
    setPreview(null)
    setResult(null)
    setFrameIndex(0)
    setPlayback('idle')
  }

  const resetSuite = () => {
    setBatchIndex(0)
    setCompletedBatches([])
    setSuiteCheck(null)
    resetRun()
  }

  const updateProgram = (next: SkillInvocation[]) => {
    setPreview(null)
    setProgram(next)
    resetSuite()
  }

  const nextBatch = () => {
    if (!batchPassed || batchIndex >= BATCHES.length - 1) return
    setPreview(null)
    setBatchIndex((current) => current + 1)
    resetRun()
  }

  const checkSuiteDirectly = () => {
    if (!validation.valid || runtimeLocked) return
    setPreview(null)
    const check = checkAllBatches(program)
    setSuiteCheck(check)
    setCompletedBatches(check.passedIndices)
    resetRun()
    if (check.failedIndices.length > 0) setBatchIndex(check.failedIndices[0])
  }

  const viewFailedBatch = () => {
    if (!suiteCheck || suiteCheck.failedIndices.length === 0) return
    const failedIndex = suiteCheck.failedIndices[0]
    const failedResult = suiteCheck.batches.find(
      ({ batchIndex: checkedIndex }) => checkedIndex === failedIndex,
    )?.result
    if (!failedResult) return
    setPreview(null)
    setBatchIndex(failedIndex)
    setResult(failedResult)
    setFrameIndex(0)
    setPlayback('paused')
  }

  const previewSkill = (skillType: WarehousePreviewType) => {
    if (runtimeLocked) return
    setPreview({ type: skillType, runId: Date.now() })
  }

  if (phase === 'manual') {
    return (
      <div className="app-shell manual-shell">
        <AppHeaderV2 phase="手动校准" />
        <ManualStage onComplete={() => setPhase('program')} />
      </div>
    )
  }

  if (phase === 'code') {
    return <CodePracticeV2 onBack={() => setPhase('program')} />
  }

  const firstFailedIndex = failedBatches[0]
  const firstFailure = suiteCheck?.batches.find(
    ({ batchIndex: checkedIndex }) => checkedIndex === firstFailedIndex,
  )?.result.error

  return (
    <div className="app-shell v2-app-shell">
      <AppHeaderV2 phase="技能调试" />
      <main className="game-workspace v2-workspace page-enter">
        <section className="warehouse-pane">
          <div className="mission-header">
            <div>
              <p className="eyebrow">货物整理 · 移动零</p>
              <h1>让机器人处理未知批次</h1>
              <p>有货箱靠左，空位靠右；货箱顺序保持不变。</p>
            </div>
            <div className="batch-progress" aria-label={`当前第 ${batchIndex + 1} 批，共 3 批`}>
              {BATCHES.map((_, index) => (
                <span
                  key={index}
                  className={`batch-dot ${index === batchIndex ? 'is-current' : ''} ${
                    completedBatches.includes(index) ? 'is-complete' : ''
                  } ${failedBatches.includes(index) ? 'is-failed' : ''}`}
                >
                  {completedBatches.includes(index) ? <Check size={14} /> : index + 1}
                </span>
              ))}
            </div>
          </div>

          <WarehouseBoard
            values={currentValues}
            scanIndex={frame?.scanIndex ?? null}
            writeIndex={frame?.writeIndex ?? null}
            changedIndices={frame?.changedIndices ?? []}
            status={currentStatus}
            message={currentMessage}
            preview={preview}
            visualMode="dual-robots"
            activeAction={activeAction}
            motionId={frame?.id ?? 'idle'}
          />

          <div className="control-deck v2-control-deck">
            <div className="runtime-controls">
              {playback === 'playing' ? (
                <button
                  type="button"
                  className="control-button primary-control"
                  onClick={pauseRun}
                  aria-label="暂停执行展示"
                  title="暂停执行展示"
                >
                  <Pause size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  className="control-button primary-control"
                  onClick={startRun}
                  disabled={!canExecute}
                  aria-label="连续展示规则"
                  title={validation.valid ? '连续展示规则' : '规则尚未满足执行条件'}
                >
                  <Play size={20} fill="currentColor" />
                </button>
              )}
              <button
                type="button"
                className="control-button"
                onClick={stepRun}
                disabled={playback === 'playing' || !canExecute}
                aria-label="单步展示规则"
                title={validation.valid ? '单步展示规则' : '规则尚未满足执行条件'}
              >
                <SkipForward size={20} />
              </button>
              <button
                type="button"
                className="control-button"
                onClick={resetRun}
                disabled={!result}
                aria-label="重置当前批次"
                title="重置当前批次"
              >
                <RotateCcw size={19} />
              </button>
              <span className="frame-counter">STEP {progressLabel}</span>
            </div>

            <div className="v2-deck-actions">
              {batchPassed && !allPassed && !suiteCheck && (
                <button type="button" className="next-command" onClick={nextBatch}>
                  下一批
                  <ChevronRight size={19} />
                </button>
              )}
              <button
                type="button"
                className="v2-check-command"
                onClick={checkSuiteDirectly}
                disabled={!validation.valid || runtimeLocked || allPassed}
                title={validation.valid ? '校验全部批次' : '规则尚未满足执行条件'}
              >
                <ShieldCheck size={19} />
                校验全部批次
              </button>
            </div>
          </div>

          {suiteCheck && !suiteCheck.passed && (
            <div className="v2-suite-failure" role="status">
              <span className="v2-failure-seal"><CircleAlert size={21} /></span>
              <div>
                <p>{suiteCheck.failedIndices.length} 个批次未通过</p>
                <span>第 {firstFailedIndex + 1} 批：{firstFailure}</span>
              </div>
              {!result && (
                <button type="button" onClick={viewFailedBatch}>
                  <PlayCircle size={17} />
                  查看第 {firstFailedIndex + 1} 批执行
                </button>
              )}
            </div>
          )}

          {allPassed && (
            <div className="suite-success" role="status">
              <span className="success-seal"><Check size={24} /></span>
              <div>
                <p>规则通过全部批次</p>
                <span>
                  {suiteCheck?.passed
                    ? '全部批次已直接校验通过。'
                    : '同一套动作完成了三批不同货物。'}
                </span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={resetSuite}
                title="重新验证"
                aria-label="重新验证"
              >
                <RotateCcw size={19} />
              </button>
              <button
                type="button"
                className="v2-code-stage-command"
                onClick={() => setPhase('code')}
              >
                进入代码实战
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </section>

        <aside className="program-pane v2-program-pane v2-inline-program-pane">
          <ProgramBuilderV2
            program={program}
            validation={validation}
            activeInstanceId={activeInstanceId}
            disabled={runtimeLocked}
            onChange={updateProgram}
            onClear={() => updateProgram([])}
            onPreviewSkill={previewSkill}
          />
          {runtimeLocked && (
            <div className="lock-notice">
              <CircleStop size={16} />
              <span>重置当前批次后可继续编辑</span>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}

function AppHeaderV2({ phase }: { phase: string }) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true"><Warehouse size={21} /></span>
        <span className="brand-name">零号仓库</span>
      </div>
      <div className="phase-chip"><span />{phase}</div>
    </header>
  )
}
