import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  CircleAlert,
  Gauge,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  StepForward,
} from 'lucide-react'
import { RAIN_WATER_CHALLENGE } from './challenges/trapping-rain-water/challenge'
import ProgramBuilder from './components/ProgramBuilder'
import SkillIntroModal from './components/SkillIntroModal'
import TerrainBoard from './components/TerrainBoard'
import { calculateWater, interpretProgram } from './game/interpreter'
import { checkAllBatches, type SuiteCheckResult } from './game/suiteValidation'
import {
  type SkillNode,
  type SkillType,
  type TraceFrame,
} from './game/model'

type Stage = 'observe' | 'program' | 'code'

const CodePractice = lazy(() => import('./components/CodePractice'))

const OBSERVE_TERRAIN = RAIN_WATER_CHALLENGE.scene.observeTerrain
const BATCHES = RAIN_WATER_CHALLENGE.automationStage.verificationBatches

const sameSet = (left: Set<number>, right: Set<number>) =>
  left.size === right.size && [...left].every((value) => right.has(value))

const blankFrame = (terrain: number[]): TraceFrame => ({
  id: 0,
  terrain,
  water: Array(terrain.length).fill(0),
  left: null,
  right: null,
  leftMax: 0,
  rightMax: 0,
  leftMaxIndex: null,
  rightMaxIndex: null,
  selectedSide: null,
  activeNodeId: null,
  changedIndex: null,
  totalWater: 0,
  message: '巡检台等待执行。',
  status: 'idle',
})

export default function App() {
  const observeWater = useMemo(() => calculateWater(OBSERVE_TERRAIN), [])
  const expectedObserveIndices = useMemo(
    () => new Set(observeWater.flatMap((depth, index) => (depth > 0 ? [index] : []))),
    [observeWater],
  )
  const [stage, setStage] = useState<Stage>(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stage') === 'code'
      ? 'code'
      : 'observe'
  ))
  const [markedIndices, setMarkedIndices] = useState<Set<number>>(new Set())
  const [observationChecked, setObservationChecked] = useState(false)
  const observationCorrect = observationChecked && sameSet(markedIndices, expectedObserveIndices)

  const [program, setProgram] = useState<SkillNode[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [passedBatches, setPassedBatches] = useState<Set<number>>(new Set())
  const [suiteCheck, setSuiteCheck] = useState<SuiteCheckResult | null>(null)
  const [frames, setFrames] = useState<TraceFrame[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [introSkill, setIntroSkill] = useState<SkillType | null>(null)

  const currentBatch = BATCHES[batchIndex]
  const currentFrame = frames[frameIndex] ?? blankFrame(currentBatch.terrain)
  const runComplete = frames.length > 0 && frameIndex === frames.length - 1
  const currentPassed = runComplete && currentFrame.status === 'success'
  const allPassed = passedBatches.size === BATCHES.length
  const runtimeLocked = frames.length > 0 && !runComplete
  const failedBatchIndices = suiteCheck?.failedIndices ?? []
  const firstFailedIndex = failedBatchIndices[0] ?? -1
  const firstFailedCheck = firstFailedIndex >= 0
    ? suiteCheck?.batches.find(({ batchIndex: checkedIndex }) => checkedIndex === firstFailedIndex)
    : null
  const verifiedTotal = BATCHES.reduce((total, batch) => total + batch.expectedTotal, 0)

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
    }, 420)
    return () => window.clearInterval(timer)
  }, [frames.length, playing])

  useEffect(() => {
    if (currentFrame.status !== 'success') return
    setPassedBatches((current) => {
      if (current.has(batchIndex)) return current
      return new Set([...current, batchIndex])
    })
  }, [batchIndex, currentFrame.status])

  const resetRun = () => {
    setPlaying(false)
    setFrames([])
    setFrameIndex(0)
  }

  const updateProgram = (next: SkillNode[]) => {
    setProgram(next)
    setBatchIndex(0)
    setPassedBatches(new Set())
    setSuiteCheck(null)
    resetRun()
  }

  const prepareRun = () => {
    setSuiteCheck(null)
    const result = interpretProgram(program, currentBatch.terrain)
    setFrames(result.frames)
    setFrameIndex(0)
    return result.frames
  }

  const play = () => {
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

  const toggleObserveIndex = (index: number) => {
    setObservationChecked(false)
    setMarkedIndices((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const goToNextBatch = () => {
    if (batchIndex >= BATCHES.length - 1) return
    setBatchIndex((current) => current + 1)
    resetRun()
  }

  const resetSuite = () => {
    setBatchIndex(0)
    setPassedBatches(new Set())
    setSuiteCheck(null)
    resetRun()
  }

  const checkSuiteDirectly = () => {
    if (program.length === 0 || runtimeLocked) return
    const check = checkAllBatches(program, BATCHES)
    setPlaying(false)
    setSuiteCheck(check)
    setPassedBatches(new Set(check.passedIndices))
    setFrames([])
    setFrameIndex(0)
    if (check.failedIndices.length > 0) setBatchIndex(check.failedIndices[0])
  }

  const viewFailedBatch = () => {
    if (!firstFailedCheck) return
    setBatchIndex(firstFailedCheck.batchIndex)
    setFrames(firstFailedCheck.result.frames)
    setFrameIndex(0)
    setPlaying(false)
  }

  const statusTone = currentFrame.status === 'error'
    ? 'error'
    : currentFrame.status === 'success'
      ? 'success'
      : 'neutral'

  const goToCodePractice = () => {
    window.history.replaceState(null, '', '?stage=code')
    setStage('code')
  }

  const returnToProgram = () => {
    window.history.replaceState(null, '', window.location.pathname)
    setStage('program')
  }

  if (stage === 'code') {
    return (
      <main className="app-shell">
        <Suspense fallback={<div className="rain-code-loading" role="status">正在启动 Java 工作台…</div>}>
          <CodePractice challenge={RAIN_WATER_CHALLENGE} onBack={returnToProgram} />
        </Suspense>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="game-header">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <div>
            <p>算法地形实验 · 02</p>
            <h1>{RAIN_WATER_CHALLENGE.title}</h1>
          </div>
        </div>
        <div className="header-metric">
          <Gauge size={18} />
          <span>目标</span>
          <strong>{RAIN_WATER_CHALLENGE.scene.target}</strong>
        </div>
      </header>

      <nav className="stage-tabs" aria-label="关卡阶段">
        <button
          type="button"
          className={stage === 'observe' ? 'is-active' : ''}
          onClick={() => setStage('observe')}
        >
          <span>01</span> 看懂水位 {observationCorrect && <Check size={16} />}
        </button>
        <button
          type="button"
          className={stage === 'program' ? 'is-active' : ''}
          onClick={() => observationCorrect && setStage('program')}
          disabled={!observationCorrect}
        >
          <span>02</span> 编排巡检
        </button>
        <button
          type="button"
          onClick={() => allPassed && goToCodePractice()}
          disabled={!allPassed}
        >
          <span>03</span> 代码实战
        </button>
      </nav>

      {stage === 'observe' ? (
        <section className="observe-layout">
          <div className="scene-column">
            <div className="phase-heading">
              <div>
                <span className="section-kicker">第一次降雨</span>
                <h2>{RAIN_WATER_CHALLENGE.manualStage.prompt}</h2>
              </div>
              <div className="phase-count">已标记 {markedIndices.size}</div>
            </div>

            <TerrainBoard
              terrain={OBSERVE_TERRAIN}
              water={observationChecked ? observeWater : Array(OBSERVE_TERRAIN.length).fill(0)}
              left={null}
              right={null}
              leftMax={0}
              rightMax={0}
              leftMaxIndex={null}
              rightMaxIndex={null}
              selectedSide={null}
              changedIndex={null}
              selectable
              selectedIndices={markedIndices}
              onToggleIndex={toggleObserveIndex}
              raining={observationChecked}
              label="水位观察地形"
            />
          </div>

          <aside className="observation-console">
            <span className="section-kicker">观测记录</span>
            <div className="observation-formula" aria-label="左右边界共同决定水位">
              <span><small>左侧已见</small>最高柱</span>
              <b>较低者决定水位</b>
              <span><small>右侧已见</small>最高柱</span>
            </div>
            <div className={`observation-result ${observationChecked ? 'is-visible' : ''}`} aria-live="polite">
              {!observationChecked && <p>等待降雨</p>}
              {observationChecked && observationCorrect && (
                <>
                  <Check size={22} />
                  <strong>判断准确</strong>
                  <p>这段地形能留下 {observeWater.reduce((sum, value) => sum + value, 0)} 格雨水。</p>
                </>
              )}
              {observationChecked && !observationCorrect && (
                <>
                  <CircleAlert size={22} />
                  <strong>标记与实际水位不同</strong>
                  <p>雨水已经显示在地形中，可以重新标记。</p>
                </>
              )}
            </div>
            <button
              type="button"
              className="command-button"
              onClick={() =>
                observationCorrect ? setStage('program') : setObservationChecked(true)
              }
            >
              {observationCorrect ? '进入巡检台' : '降雨验证'}
              <ChevronRight size={18} />
            </button>
          </aside>
        </section>
      ) : (
        <section className="program-layout">
          <div className="simulation-column">
            <div className="phase-heading">
              <div>
                <span className="section-kicker">{currentBatch.name}</span>
                <h2>同一套规则，三段地形</h2>
              </div>
              <div className="batch-progress" aria-label={`已通过 ${passedBatches.size} 个批次`}>
                {BATCHES.map((batch, index) => (
                  <span
                    key={batch.name}
                    className={`${index === batchIndex ? 'is-current' : ''} ${passedBatches.has(index) ? 'is-passed' : ''} ${failedBatchIndices.includes(index) ? 'is-failed' : ''}`}
                  >
                    {passedBatches.has(index) ? <Check size={13} /> : index + 1}
                  </span>
                ))}
              </div>
            </div>

            <TerrainBoard
              terrain={currentFrame.terrain}
              water={currentFrame.water}
              left={currentFrame.left}
              right={currentFrame.right}
              leftMax={currentFrame.leftMax}
              rightMax={currentFrame.rightMax}
              leftMaxIndex={currentFrame.leftMaxIndex}
              rightMaxIndex={currentFrame.rightMaxIndex}
              selectedSide={currentFrame.selectedSide}
              changedIndex={currentFrame.changedIndex}
              raining={playing || frames.length > 0}
              label={`${currentBatch.name}双指针巡检动画`}
            />

            <div className={`runtime-strip tone-${statusTone}`} aria-live="polite">
              <span className="runtime-state">
                {currentFrame.status === 'error' && <CircleAlert size={18} />}
                {currentFrame.status === 'success' && <Check size={18} />}
                {currentFrame.status !== 'error' && currentFrame.status !== 'success' && <SkipForward size={18} />}
              </span>
              <p>{currentFrame.message}</p>
              <strong>{currentFrame.totalWater} 格</strong>
            </div>

            <div className="run-controls" aria-label="巡检运行控制">
              <button
                type="button"
                className="icon-command"
                onClick={() => (playing ? setPlaying(false) : play())}
                disabled={program.length === 0 || allPassed}
                aria-label={playing ? '暂停巡检' : '播放巡检'}
                title={playing ? '暂停' : '播放'}
              >
                {playing ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                type="button"
                className="icon-command"
                onClick={step}
                disabled={playing || program.length === 0 || allPassed}
                aria-label="单步巡检"
                title="单步"
              >
                <StepForward size={20} />
              </button>
              <button
                type="button"
                className="icon-command"
                onClick={resetRun}
                disabled={playing || frames.length === 0}
                aria-label="重置当前批次"
                title="重置当前批次"
              >
                <RotateCcw size={19} />
              </button>
              <div className="frame-counter">{frames.length > 0 ? `${frameIndex + 1} / ${frames.length}` : '待命'}</div>
              <div className="run-control-actions">
                {currentPassed && batchIndex < BATCHES.length - 1 && !suiteCheck && (
                  <button type="button" className="next-batch-button" onClick={goToNextBatch}>
                    下一段地形 <ChevronRight size={18} />
                  </button>
                )}
                {RAIN_WATER_CHALLENGE.automationStage.programContract.allowDirectSuiteValidation && (
                  <button
                    type="button"
                    className="suite-check-button"
                    onClick={checkSuiteDirectly}
                    disabled={program.length === 0 || runtimeLocked || allPassed}
                    title={program.length === 0 ? '请先编排巡检程序' : '校验全部批次'}
                  >
                    <ShieldCheck size={18} />
                    校验全部批次
                  </button>
                )}
              </div>
            </div>

            {suiteCheck && !suiteCheck.passed && (
              <div className="suite-failure-band" role="status">
                <span><CircleAlert size={21} /></span>
                <div>
                  <strong>{suiteCheck.failedIndices.length} 段地形未通过</strong>
                  <p>第 {firstFailedIndex + 1} 段：{firstFailedCheck?.result.error ?? '巡检结果与目标不同。'}</p>
                </div>
                {frames.length === 0 && (
                  <button type="button" onClick={viewFailedBatch}>
                    <PlayCircle size={17} />
                    查看第 {firstFailedIndex + 1} 段执行
                  </button>
                )}
              </div>
            )}

            {allPassed && (
              <div className="completion-band">
                <span><Check size={22} /></span>
                <div>
                  <strong>全部地形巡检完成</strong>
                  <p>{suiteCheck?.passed ? '全部地形已直接校验通过。' : `同一套双端规则记录了 ${verifiedTotal} 格雨水。`}</p>
                </div>
                <button type="button" className="completion-reset" onClick={resetSuite} aria-label="重新验证" title="重新验证">
                  <RotateCcw size={18} />
                </button>
                <button type="button" onClick={goToCodePractice}>
                  进入代码实战 <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          <ProgramBuilder
            program={program}
            activeNodeId={currentFrame.activeNodeId}
            disabled={runtimeLocked}
            skills={RAIN_WATER_CHALLENGE.skills}
            onChange={updateProgram}
            onClear={() => updateProgram([])}
            onPreviewSkill={setIntroSkill}
          />
        </section>
      )}
      {introSkill && (
        <SkillIntroModal skillType={introSkill} onClose={() => setIntroSkill(null)} />
      )}
    </main>
  )
}
