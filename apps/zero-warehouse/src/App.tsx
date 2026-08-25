import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  CircleStop,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Warehouse,
} from 'lucide-react'
import { ManualStage } from './components/ManualStage'
import { ProgramBuilderV1 } from './components/ProgramBuilder'
import { WarehouseBoard } from './components/WarehouseBoard'
import { interpretProgram } from './game/interpreter'
import { BATCHES, type BlockNode, type InterpretationResult } from './game/model'

type Phase = 'manual' | 'program'
type Playback = 'idle' | 'playing' | 'paused'

function App() {
  const [phase, setPhase] = useState<Phase>('manual')
  const [program, setProgram] = useState<BlockNode[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [completedBatches, setCompletedBatches] = useState<number[]>([])
  const [result, setResult] = useState<InterpretationResult | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [playback, setPlayback] = useState<Playback>('idle')

  const batch = BATCHES[batchIndex]
  const frame = result?.frames[frameIndex]
  const isAtEnd = Boolean(result && frameIndex === result.frames.length - 1)
  const runtimeLocked = Boolean(result && !isAtEnd)
  const batchPassed = completedBatches.includes(batchIndex)
  const allPassed = completedBatches.length === BATCHES.length

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

  const currentValues = frame?.values ?? batch.input
  const currentMessage = frame?.message ?? '机器人待命，等待一套可执行的规则。'
  const currentStatus = frame?.status ?? 'idle'
  const activeBlockId = frame?.activeBlockId ?? null
  const progressLabel = useMemo(
    () => `${Math.min(frameIndex + 1, result?.frames.length ?? 1)} / ${result?.frames.length ?? 1}`,
    [frameIndex, result],
  )

  const startRun = () => {
    if (result && !isAtEnd) {
      setPlayback('playing')
      return
    }
    const nextResult = interpretProgram(program, batch.input)
    setResult(nextResult)
    setFrameIndex(0)
    setPlayback('playing')
  }

  const pauseRun = () => setPlayback('paused')

  const stepRun = () => {
    if (!result || isAtEnd) {
      const nextResult = interpretProgram(program, batch.input)
      setResult(nextResult)
      setFrameIndex(Math.min(1, nextResult.frames.length - 1))
    } else {
      setFrameIndex((current) => Math.min(current + 1, result.frames.length - 1))
    }
    setPlayback('paused')
  }

  const resetRun = () => {
    setResult(null)
    setFrameIndex(0)
    setPlayback('idle')
  }

  const resetSuite = () => {
    setBatchIndex(0)
    setCompletedBatches([])
    resetRun()
  }

  const updateProgram = (next: BlockNode[]) => {
    setProgram(next)
    resetSuite()
  }

  const clearProgram = () => {
    setProgram([])
    resetSuite()
  }

  const nextBatch = () => {
    if (!batchPassed || batchIndex >= BATCHES.length - 1) return
    setBatchIndex((current) => current + 1)
    resetRun()
  }

  if (phase === 'manual') {
    return (
      <div className="app-shell manual-shell">
        <AppHeader phase="手动校准" />
        <ManualStage onComplete={() => setPhase('program')} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppHeader phase="规则调试" />
      <main className="game-workspace page-enter">
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
                  }`}
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
          />

          <div className="control-deck">
            <div className="runtime-controls">
              {playback === 'playing' ? (
                <button
                  type="button"
                  className="control-button primary-control"
                  onClick={pauseRun}
                  aria-label="暂停执行"
                  title="暂停执行"
                >
                  <Pause size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  className="control-button primary-control"
                  onClick={startRun}
                  disabled={allPassed || batchPassed}
                  aria-label="播放规则"
                  title="播放规则"
                >
                  <Play size={20} fill="currentColor" />
                </button>
              )}
              <button
                type="button"
                className="control-button"
                onClick={stepRun}
                disabled={playback === 'playing' || allPassed || batchPassed}
                aria-label="执行下一步"
                title="执行下一步"
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

            {batchPassed && !allPassed && (
              <button type="button" className="next-command" onClick={nextBatch}>
                下一批
                <ChevronRight size={19} />
              </button>
            )}
          </div>

          {allPassed && (
            <div className="suite-success" role="status">
              <span className="success-seal"><Check size={24} /></span>
              <div>
                <p>规则通过全部批次</p>
                <span>同一套动作完成了三批不同货物。</span>
              </div>
              <button type="button" className="icon-button" onClick={resetSuite} title="重新验证" aria-label="重新验证">
                <RotateCcw size={19} />
              </button>
            </div>
          )}
        </section>

        <aside className="program-pane">
          <ProgramBuilderV1
            program={program}
            activeBlockId={activeBlockId}
            disabled={runtimeLocked}
            onChange={updateProgram}
            onClear={clearProgram}
          />
          {runtimeLocked && (
            <div className="lock-notice"><CircleStop size={16} /><span>重置当前批次后可继续编辑</span></div>
          )}
        </aside>
      </main>
    </div>
  )
}

function AppHeader({ phase }: { phase: string }) {
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

export default App
