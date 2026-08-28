import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Braces,
  Check,
  CircleAlert,
  Code2,
  Gauge,
  GitBranch,
  LayoutGrid,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  StepForward,
} from 'lucide-react'
import { SkillProgramBuilder } from '../../shared/program'
import { ANAGRAM_BATCHES, findAnagramIndices } from './cases'
import { ANAGRAM_CHALLENGE } from './challenge'
import SignalBoard from './components/SignalBoard'
import SkillPreview from './components/SkillPreview'
import { interpretAnagramProgram } from './interpreter'
import {
  ANAGRAM_SKILLS,
  createAnagramSkillNode,
  type AnagramSkillNode,
  type AnagramSkillType,
  type AnagramTraceFrame,
} from './model'
import { checkAnagramBatches, type AnagramSuiteCheck } from './suiteValidation'

const CodePractice = lazy(() => import('../../components/CodePractice')) as unknown as typeof import('../../components/CodePractice').default

type Stage = 'manual' | 'program' | 'code'

interface AnagramAppProps {
  onExit?: () => void
}

const STAGE_LABELS = ['动手理解', '技能认识', '规则编排', '调试执行', '多批验证', '代码实战']
const MANUAL_INPUT = { source: 'cbaebabacd', pattern: 'abc' }
const MANUAL_EXPECTED = findAnagramIndices(MANUAL_INPUT)

const countsOf = (value: string) => {
  const counts = Array(26).fill(0) as number[]
  for (const character of value) counts[character.charCodeAt(0) - 97] += 1
  return counts
}

const blankFrame = (
  source: string,
  pattern: string,
  message = '频谱滑窗站等待执行。',
): AnagramTraceFrame => ({
  id: 0,
  source,
  pattern,
  targetCounts: countsOf(pattern),
  windowCounts: Array(26).fill(0),
  left: 0,
  right: null,
  patternIndex: null,
  activeChar: null,
  enteringIndex: null,
  leavingIndex: null,
  matches: [],
  frequenciesMatch: false,
  overflow: false,
  activeNodeId: null,
  message,
  status: 'idle',
})

const skillIcon = (type: AnagramSkillType, size: number) => {
  switch (type) {
    case 'prepare': return <Gauge size={size} />
    case 'scan-source': return <ScanSearch size={size} />
    case 'add-incoming': return <Plus size={size} />
    case 'if-overflow': return <GitBranch size={size} />
    case 'if-match': return <GitBranch size={size} />
  }
}

export default function AnagramApp({ onExit }: AnagramAppProps) {
  const directCode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('stage') === 'code'
  const [stage, setStage] = useState<Stage>(directCode ? 'code' : 'manual')
  const [manualStarts, setManualStarts] = useState<Set<number>>(new Set())
  const [manualFocus, setManualFocus] = useState<number | null>(null)
  const [manualMessage, setManualMessage] = useState('选择所有与目标卡频谱相同的固定宽度窗口起点。')
  const [program, setProgram] = useState<AnagramSkillNode[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [passedBatches, setPassedBatches] = useState<Set<number>>(new Set())
  const [suiteCheck, setSuiteCheck] = useState<AnagramSuiteCheck | null>(null)
  const [frames, setFrames] = useState<AnagramTraceFrame[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [previewSkill, setPreviewSkill] = useState<AnagramSkillType | null>(null)

  const manualComplete = manualStarts.size === MANUAL_EXPECTED.length
    && MANUAL_EXPECTED.every((index) => manualStarts.has(index))
  const currentBatch = ANAGRAM_BATCHES[batchIndex]
  const currentFrame = frames[frameIndex]
    ?? blankFrame(currentBatch.input.source, currentBatch.input.pattern)
  const runComplete = frames.length > 0 && frameIndex === frames.length - 1
  const currentPassed = runComplete && currentFrame.status === 'success'
  const allPassed = passedBatches.size === ANAGRAM_BATCHES.length
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
    }, 420)
    return () => window.clearInterval(timer)
  }, [frames.length, playing])

  useEffect(() => {
    if (!currentPassed) return
    setPassedBatches((current) => current.has(batchIndex)
      ? current
      : new Set([...current, batchIndex]))
  }, [batchIndex, currentPassed])

  const manualFrame = useMemo(() => {
    const frame = blankFrame(MANUAL_INPUT.source, MANUAL_INPUT.pattern, manualMessage)
    if (manualFocus === null) return { ...frame, matches: [...manualStarts] }
    const windowValue = MANUAL_INPUT.source.slice(manualFocus, manualFocus + MANUAL_INPUT.pattern.length)
    const windowCounts = countsOf(windowValue)
    const targetCounts = countsOf(MANUAL_INPUT.pattern)
    const match = targetCounts.every((count, index) => count === windowCounts[index])
    return {
      ...frame,
      left: manualFocus,
      right: manualFocus + MANUAL_INPUT.pattern.length - 1,
      windowCounts,
      matches: [...manualStarts].sort((left, right) => left - right),
      frequenciesMatch: match,
      status: match ? 'success' as const : 'running' as const,
    }
  }, [manualFocus, manualMessage, manualStarts])

  const selectManualStart = (index: number) => {
    const next = new Set(manualStarts)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setManualStarts(next)
    setManualFocus(index)
    const isMatch = MANUAL_EXPECTED.includes(index)
    const complete = next.size === MANUAL_EXPECTED.length
      && MANUAL_EXPECTED.every((expectedIndex) => next.has(expectedIndex))
    setManualMessage(complete
      ? '0 和 6 两个窗口都与目标频谱一致，可以进入技能台。'
      : next.has(index)
        ? isMatch
          ? `${index} 号窗口频谱一致，继续寻找其他命中。`
          : `${index} 号窗口频谱不同；再次点击可以取消选择。`
        : `已取消 ${index} 号窗口。`)
  }

  const resetRuntime = () => {
    setPlaying(false)
    setFrames([])
    setFrameIndex(0)
  }

  const invalidateVerification = (nextProgram: AnagramSkillNode[]) => {
    setProgram(nextProgram)
    resetRuntime()
    setPassedBatches(new Set())
    setSuiteCheck(null)
  }

  const runCurrentBatch = () => {
    if (program.length === 0 || runtimeLocked) return
    const result = interpretAnagramProgram(program, currentBatch.input)
    setSuiteCheck(null)
    setFrames(result.frames)
    setFrameIndex(0)
    setPlaying(result.frames.length > 1)
  }

  const verifyAll = () => {
    if (program.length === 0 || runtimeLocked) return
    const result = checkAnagramBatches(program, ANAGRAM_BATCHES)
    setPlaying(false)
    setSuiteCheck(result)
    setPassedBatches(new Set(result.passedIndices))
    if (result.passed) {
      const final = result.batches.at(-1)?.result.frames ?? []
      setBatchIndex(ANAGRAM_BATCHES.length - 1)
      setFrames(final)
      setFrameIndex(Math.max(0, final.length - 1))
    }
  }

  const inspectFailedBatch = () => {
    if (!firstFailedCheck) return
    setBatchIndex(firstFailedCheck.batchIndex)
    setFrames(firstFailedCheck.result.frames)
    setFrameIndex(0)
    setPlaying(false)
  }

  const reverify = () => {
    resetRuntime()
    setPassedBatches(new Set())
    setSuiteCheck(null)
    setBatchIndex(0)
  }

  const chooseStage = (index: number) => {
    if (index === 0) setStage('manual')
    else if (index === 5 && (allPassed || directCode)) setStage('code')
    else if (index > 0 && index < 5 && manualComplete) setStage('program')
  }

  if (stage === 'code') {
    return (
      <Suspense fallback={<div className="anagram-loading">正在打开 Java 频谱台…</div>}>
        <CodePractice challenge={ANAGRAM_CHALLENGE} onBack={() => setStage('program')} onExit={onExit} />
      </Suspense>
    )
  }

  return (
    <div className="anagram-app">
      <header className="anagram-topbar">
        <a href="/" className="anagram-brand" aria-label="返回技能编程挑战目录">
          <span><Braces size={21} /></span>
          <div><strong>频谱滑窗站</strong><small>找到字符串中所有字母异位词</small></div>
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
        {onExit && <button type="button" className="anagram-exit" onClick={onExit}><LayoutGrid size={17} />挑战选择</button>}
      </header>

      {stage === 'manual' ? (
        <main className="anagram-manual">
          <section className="anagram-section-heading">
            <div><p>01 动手理解</p><h1>找出同频窗口</h1></div>
            <span>{manualStarts.size} 个起点已选择</span>
          </section>
          <div className="anagram-manual-workspace">
            <SignalBoard
              frame={manualFrame}
              label="动手寻找字母异位词窗口"
              selectedStarts={manualStarts}
              selectable
              onSelectStart={selectManualStart}
            />
            <aside className="anagram-manual-panel">
              <p>固定窗口规则</p>
              <h2>宽度 = {MANUAL_INPUT.pattern.length}</h2>
              <dl>
                <div><dt>目标卡</dt><dd>{MANUAL_INPUT.pattern}</dd></div>
                <div><dt>目标频谱</dt><dd>a:1 · b:1 · c:1</dd></div>
                <div><dt>命中要求</dt><dd>26 格频次全部相等</dd></div>
              </dl>
              <div className="anagram-manual-selection">
                {[...manualStarts].sort((left, right) => left - right).map((start) => (
                  <button type="button" key={start} onClick={() => selectManualStart(start)}>
                    <span>{start}</span>
                    <code>{MANUAL_INPUT.source.slice(start, start + MANUAL_INPUT.pattern.length)}</code>
                    <b>{MANUAL_EXPECTED.includes(start) ? '同频' : '不同'}</b>
                  </button>
                ))}
                {manualStarts.size === 0 && <em>还没有选择窗口起点</em>}
              </div>
              <button type="button" className="anagram-primary" disabled={!manualComplete} onClick={() => setStage('program')}>
                进入频谱技能台<ArrowRight size={17} />
              </button>
            </aside>
          </div>
        </main>
      ) : (
        <main className="anagram-program">
          <section className="anagram-section-heading anagram-program-heading">
            <div><p>02—05 技能与验证</p><h1>编排固定滑窗规则</h1></div>
            <span>{passedBatches.size} / {ANAGRAM_BATCHES.length} 批通过</span>
          </section>
          <div className="anagram-workbench">
            <div className="anagram-runtime-panel">
              <div className="anagram-batch-tabs" role="tablist" aria-label="验证批次">
                {ANAGRAM_BATCHES.map((batch, index) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={batchIndex === index}
                    key={batch.id}
                    className={batchIndex === index ? 'is-active' : ''}
                    onClick={() => {
                      if (!runtimeLocked) {
                        setBatchIndex(index)
                        resetRuntime()
                        setSuiteCheck(null)
                      }
                    }}
                  >
                    <span>{passedBatches.has(index) ? <Check size={13} /> : index + 1}</span>{batch.name}
                  </button>
                ))}
              </div>

              <SignalBoard frame={currentFrame} label={`${currentBatch.name}执行场景`} />

              <div className="anagram-playback">
                <div><span>执行帧</span><strong>{frames.length === 0 ? '—' : `${frameIndex + 1} / ${frames.length}`}</strong></div>
                <button type="button" className="anagram-primary" disabled={program.length === 0 || runtimeLocked && !playing} onClick={() => {
                  if (playing) setPlaying(false)
                  else if (frames.length > 0 && !runComplete) setPlaying(true)
                  else runCurrentBatch()
                }}>
                  {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
                  {playing ? '暂停' : frames.length > 0 && !runComplete ? '继续' : '运行当前批次'}
                </button>
                <button type="button" className="anagram-icon-button" disabled={frames.length === 0 || playing || runComplete} onClick={() => setFrameIndex((current) => Math.min(current + 1, frames.length - 1))} aria-label="单步执行" title="单步执行"><StepForward size={18} /></button>
                <button type="button" className="anagram-icon-button" disabled={frames.length === 0} onClick={resetRuntime} aria-label="重置执行" title="重置执行"><RotateCcw size={18} /></button>
              </div>

              <section className="anagram-verification">
                <header><div><p>05 多批验证</p><h2>校验固定窗口能否泛化</h2></div><ShieldCheck size={21} /></header>
                {suiteCheck ? (
                  <div className={`anagram-suite-result ${suiteCheck.passed ? 'is-success' : 'is-failure'}`}>
                    {suiteCheck.passed ? <Check size={18} /> : <CircleAlert size={18} />}
                    <div>
                      <strong>{suiteCheck.passed ? '全部批次通过' : `${suiteCheck.failedIndices.length} 批未通过`}</strong>
                      <p>{suiteCheck.passed ? '固定滑窗规则已经通过不同频谱分布。' : firstFailedCheck?.result.error ?? '首个失败批次需要继续调试。'}</p>
                    </div>
                    {!suiteCheck.passed && firstFailedCheck && <button type="button" onClick={inspectFailedBatch}>查看第 {firstFailedCheck.batchIndex + 1} 批</button>}
                  </div>
                ) : (
                  <p className="anagram-verification-neutral">直接使用当前程序运行三批数据，不会自动填入或修改技能。</p>
                )}
                <div className="anagram-verification-actions">
                  <button type="button" onClick={verifyAll} disabled={program.length === 0 || runtimeLocked}><ShieldCheck size={17} />校验全部批次</button>
                  {(suiteCheck || passedBatches.size > 0) && <button type="button" onClick={reverify}><RotateCcw size={16} />重新验证</button>}
                  <button type="button" className="anagram-primary" disabled={!allPassed} onClick={() => setStage('code')}><Code2 size={17} />进入代码实战</button>
                </div>
              </section>
            </div>

            <SkillProgramBuilder
              program={program}
              activeNodeId={currentFrame.activeNodeId}
              disabled={runtimeLocked}
              skills={ANAGRAM_SKILLS}
              createNode={createAnagramSkillNode}
              renderSkillIcon={skillIcon}
              onChange={invalidateVerification}
              onClear={() => invalidateVerification([])}
              onPreviewSkill={setPreviewSkill}
              labels={{
                ariaLabel: '固定滑动窗口技能编排器',
                shelfKicker: '技能架',
                shelfTitle: '频谱技能',
                programKicker: '执行顺序',
                programTitle: '滑窗程序',
                rootScope: '主流程',
                nestedScope: '作用域内',
                clearProgram: '清空滑窗程序',
                emptyProgram: '从技能架选择第一项',
              }}
            />
          </div>
        </main>
      )}

      {previewSkill && <SkillPreview type={previewSkill} onClose={() => setPreviewSkill(null)} />}
    </div>
  )
}
