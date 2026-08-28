import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Code2,
  FastForward,
  Gauge,
  LayoutGrid,
  ListTree,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  SkipForward,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { MINIMUM_WINDOW_CHALLENGE } from './challenge'
import CodePractice from '../../components/CodePractice'
import { MINIMUM_WINDOW_BATCHES, findMinimumWindow } from './cases'
import { validateMinimumWindowProgram } from './contracts'
import MinimumWindowBoard from './components/MinimumWindowBoard'
import MinimumWindowProgramBuilder from './components/MinimumWindowProgramBuilder'
import { interpretMinimumWindowProgram } from './interpreter'
import {
  getMinimumWindowSkill,
  type MinimumWindowInterpretationResult,
  type MinimumWindowSkillNode,
  type MinimumWindowSkillType,
  type MinimumWindowTraceFrame,
} from './model'
import { checkMinimumWindowBatches, type MinimumWindowSuiteCheckResult } from './suiteValidation'

type Stage = 'manual' | 'skills' | 'program' | 'debug' | 'verify' | 'code'
type MobilePane = 'scene' | 'program'

interface MinimumWindowAppProps {
  onExit?: () => void
}

const STAGES: Array<{ id: Stage; number: string; label: string }> = [
  { id: 'manual', number: '01', label: '动手理解' },
  { id: 'skills', number: '02', label: '技能认识' },
  { id: 'program', number: '03', label: '规则编排' },
  { id: 'debug', number: '04', label: '调试执行' },
  { id: 'verify', number: '05', label: '多批验证' },
  { id: 'code', number: '06', label: '代码实战' },
]

const skillPreviewCopy: Record<MinimumWindowSkillType, { before: string; effect: string; code: string }> = {
  'initialize-window': { before: '校准台尚未开始', effect: '清空窗口状态，并把目标字符逐个登记为欠账', code: 'int[] need = ...; while (targetIndex < t.length()) { ... }' },
  'scan-source': { before: '目标欠账已经完整登记', effect: '右标尺逐字扩张，每轮完成后自动前进', code: 'while (right < s.length())' },
  'read-incoming-character': { before: '右标尺停在一个新字符', effect: '读取字符、补齐总欠账并更新字符余额', code: 'incoming = s.charAt(right); ...' },
  'shrink-covered-window': { before: '入窗记账已经完成', effect: '总欠账为零时持续收缩', code: 'while (missing == 0)' },
  'save-best-window': { before: '窗口完整覆盖目标', effect: '比较当前宽度，更短时同步保存起点与长度', code: 'if (currentLength < bestLength) { ... }' },
  'read-outgoing-character': { before: '本轮最短记录已经检查', effect: '移出左字符、恢复欠账并推进左标尺', code: 'outgoing = s.charAt(left); ...; left++;' },
}

const initialFrame = (source: string, target: string): MinimumWindowTraceFrame => ({
  id: 0,
  source,
  target,
  targetIndex: 0,
  left: 0,
  right: 0,
  incomingCode: null,
  outgoingCode: null,
  missing: target.length,
  bestStart: null,
  bestLength: null,
  needEntries: [],
  changedCode: null,
  activeNodeId: null,
  message: '窗口校准台等待执行。',
  status: 'idle',
})

export default function MinimumWindowApp({ onExit }: MinimumWindowAppProps) {
  const directCode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('stage') === 'code'
  const [stage, setStage] = useState<Stage>(directCode ? 'code' : 'manual')
  const [highestStage, setHighestStage] = useState(directCode ? 5 : 0)
  const [manualStart, setManualStart] = useState<number | null>(null)
  const [manualEnd, setManualEnd] = useState<number | null>(null)
  const [manualAttempted, setManualAttempted] = useState(false)
  const [previewSkill, setPreviewSkill] = useState<MinimumWindowSkillType | null>(null)
  const [previewedSkills, setPreviewedSkills] = useState<Set<MinimumWindowSkillType>>(new Set())
  const [program, setProgram] = useState<MinimumWindowSkillNode[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [passedBatches, setPassedBatches] = useState<Set<number>>(new Set())
  const [suiteCheck, setSuiteCheck] = useState<MinimumWindowSuiteCheckResult | null>(null)
  const [frames, setFrames] = useState<MinimumWindowTraceFrame[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [programIssue, setProgramIssue] = useState<string | null>(null)
  const [mobilePane, setMobilePane] = useState<MobilePane>('scene')

  const manualSource = MINIMUM_WINDOW_CHALLENGE.scene.source
  const manualTarget = MINIMUM_WINDOW_CHALLENGE.scene.target
  const expectedManual = useMemo(
    () => findMinimumWindow({ source: manualSource, target: manualTarget }),
    [manualSource, manualTarget],
  )
  const selectedLow = manualStart === null ? null : Math.min(manualStart, manualEnd ?? manualStart)
  const selectedHigh = manualStart === null ? null : Math.max(manualStart, manualEnd ?? manualStart)
  const manualSelection = selectedLow === null || selectedHigh === null
    ? ''
    : manualSource.slice(selectedLow, selectedHigh + 1)
  const manualCorrect = manualAttempted && manualSelection === expectedManual

  const currentBatch = MINIMUM_WINDOW_BATCHES[batchIndex]
  const currentFrame = frames[frameIndex] ?? initialFrame(currentBatch.source, currentBatch.target)
  const runComplete = frames.length > 0 && frameIndex === frames.length - 1
  const currentPassed = runComplete && currentFrame.status === 'success'
  const runtimeLocked = frames.length > 0 && !runComplete
  const allPassed = passedBatches.size === MINIMUM_WINDOW_BATCHES.length
  const programContract = useMemo(() => validateMinimumWindowProgram(program), [program])
  const firstFailedIndex = suiteCheck?.failedIndices[0] ?? -1
  const firstFailedCheck = firstFailedIndex >= 0
    ? suiteCheck?.batches.find((batch) => batch.batchIndex === firstFailedIndex)
    : null

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
    }, 360)
    return () => window.clearInterval(timer)
  }, [frames.length, playing])

  useEffect(() => {
    if (!currentPassed) return
    setPassedBatches((current) => current.has(batchIndex) ? current : new Set([...current, batchIndex]))
    if (stage === 'debug') setHighestStage((current) => Math.max(current, 4))
  }, [batchIndex, currentPassed, stage])

  const resetRun = () => {
    setPlaying(false)
    setFrames([])
    setFrameIndex(0)
  }

  const updateProgram = (next: MinimumWindowSkillNode[]) => {
    setProgram(next)
    setProgramIssue(null)
    setBatchIndex(0)
    setPassedBatches(new Set())
    setSuiteCheck(null)
    resetRun()
    if (stage !== 'program') setStage('program')
    setHighestStage((current) => Math.min(current, 2))
  }

  const prepareRun = (): MinimumWindowInterpretationResult => {
    setSuiteCheck(null)
    const result = interpretMinimumWindowProgram(program, {
      source: currentBatch.source,
      target: currentBatch.target,
    })
    setFrames(result.frames)
    setFrameIndex(0)
    return result
  }

  const play = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    const nextFrames = frames.length > 0 && !runComplete ? frames : prepareRun().frames
    if (nextFrames.length > 1) setPlaying(true)
  }

  const step = () => {
    setPlaying(false)
    if (frames.length === 0 || runComplete) {
      const result = prepareRun()
      setFrameIndex(Math.min(1, result.frames.length - 1))
      return
    }
    setFrameIndex((current) => Math.min(current + 1, frames.length - 1))
  }

  const checkProgramStructure = () => {
    if (!programContract.valid) {
      setProgramIssue(programContract.issues[0]?.message ?? '规则结构还不完整。')
      return
    }
    setProgramIssue(null)
    setHighestStage((current) => Math.max(current, 3))
    setStage('debug')
    setMobilePane('scene')
  }

  const verifyAll = () => {
    if (program.length === 0 || runtimeLocked) return
    const next = checkMinimumWindowBatches(program, MINIMUM_WINDOW_BATCHES)
    setPlaying(false)
    setSuiteCheck(next)
    setPassedBatches(new Set(next.passedIndices))
    setFrames([])
    setFrameIndex(0)
    if (next.failedIndices.length > 0) setBatchIndex(next.failedIndices[0])
    if (next.passed) setHighestStage((current) => Math.max(current, 5))
  }

  const resetVerification = () => {
    setBatchIndex(0)
    setPassedBatches(new Set())
    setSuiteCheck(null)
    resetRun()
    setHighestStage((current) => Math.min(current, 4))
  }

  const goToCode = () => {
    window.history.replaceState(null, '', '?stage=code')
    setStage('code')
  }

  const returnFromCode = () => {
    window.history.replaceState(null, '', window.location.pathname)
    setStage('verify')
    setHighestStage((current) => Math.max(current, 4))
  }

  const selectManualIndex = (index: number) => {
    setManualAttempted(false)
    if (manualStart === null || manualEnd !== null) {
      setManualStart(index)
      setManualEnd(null)
    } else {
      setManualEnd(index)
    }
  }

  const stageUnlocked = (index: number) => directCode || index <= highestStage

  if (stage === 'code') {
    return (
      <main className="mw-app-shell mw-code-stage">
        <CodePractice
          challenge={MINIMUM_WINDOW_CHALLENGE}
          onBack={returnFromCode}
          onExit={onExit}
        />
      </main>
    )
  }

  return (
    <main className="mw-app-shell">
      <header className="mw-header">
        <div className="mw-brand">
          <span aria-hidden="true"><span /><span /><span /></span>
          <div><p>算法校准实验 · 03</p><h1>{MINIMUM_WINDOW_CHALLENGE.title}</h1></div>
        </div>
        <div className="mw-header-actions">
          {onExit && <button type="button" onClick={onExit}><LayoutGrid size={17} />挑战选择</button>}
          <div><Gauge size={17} /><span>策略</span><strong>可变滑动窗口</strong></div>
        </div>
      </header>

      <nav className="mw-stage-nav" aria-label="六阶段学习流程">
        {STAGES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={stage === item.id ? 'is-active' : ''}
            disabled={!stageUnlocked(index)}
            onClick={() => stageUnlocked(index) && (item.id === 'code' ? goToCode() : setStage(item.id))}
          >
            <span>{item.number}</span><strong>{item.label}</strong>
            {index < highestStage && <Check size={13} />}
          </button>
        ))}
      </nav>

      {stage === 'manual' && (
        <section className="mw-manual-layout">
          <div className="mw-phase-heading">
            <div><span>01 · 动手理解</span><h2>先亲手框出最短覆盖窗口</h2></div>
            <p>{MINIMUM_WINDOW_CHALLENGE.manualStage.prompt}</p>
          </div>
          <MinimumWindowBoard
            source={manualSource}
            target={manualTarget}
            left={selectedLow}
            right={selectedHigh}
            missing={manualTarget.length}
            bestStart={manualCorrect ? selectedLow : null}
            bestLength={manualCorrect ? manualSelection.length : null}
            selectedStart={manualStart}
            selectedEnd={manualEnd}
            interactive
            onSelectIndex={selectManualIndex}
          />
          <div className={`mw-manual-feedback ${manualAttempted ? manualCorrect ? 'is-success' : 'is-error' : ''}`} role="status">
            <div>
              {manualAttempted ? manualCorrect ? <Check size={19} /> : <CircleAlert size={19} /> : <Target size={19} />}
              <span>
                {!manualAttempted
                  ? manualSelection ? `当前窗口“${manualSelection}”，可以开始校验。` : '先点起点，再点终点。窗口必须连续。'
                  : manualCorrect
                    ? `“${manualSelection}”覆盖全部目标字符，并且已经不能再缩短。`
                    : `“${manualSelection || '空'}”还不是最短完整窗口，检查重复次数和两侧边界。`}
              </span>
            </div>
            <div>
              <button type="button" onClick={() => { setManualStart(null); setManualEnd(null); setManualAttempted(false) }} aria-label="重置选窗" title="重置选窗"><RotateCcw size={17} /></button>
              {!manualCorrect
                ? <button type="button" className="is-primary" onClick={() => setManualAttempted(true)} disabled={manualStart === null || manualEnd === null}><Check size={17} />校验窗口</button>
                : <button type="button" className="is-primary" onClick={() => { setHighestStage(1); setStage('skills') }}>认识窗口技能<ChevronRight size={17} /></button>}
            </div>
          </div>
        </section>
      )}

      {stage === 'skills' && (
        <section className="mw-skills-stage">
          <div className="mw-phase-heading">
            <div><span>02 · 技能认识</span><h2>记住六步最小窗口逻辑</h2></div>
            <p>先建立目标欠账，再扩张右侧；覆盖后记录更短窗口并收缩左侧。</p>
          </div>
          <MinimumWindowBoard source="ADOBEC" target="ABC" left={1} right={4} missing={1} bestStart={null} bestLength={null} />
          <div className="mw-skill-overview">
            {(['目标登记', '窗口扩张', '覆盖收缩'] as const).map((group) => (
              <section key={group}>
                <header><span>{group === '目标登记' ? 'A' : group === '窗口扩张' ? 'B' : 'C'}</span><h3>{group}</h3></header>
                <div>
                  {MINIMUM_WINDOW_CHALLENGE.skills.filter((skill, index) => (
                    group === '目标登记' ? index === 0 : group === '窗口扩张' ? index >= 1 && index <= 2 : index >= 3
                  )).map((skill) => (
                    <button
                      key={skill.type}
                      type="button"
                      className={previewedSkills.has(skill.type) ? 'is-previewed' : ''}
                      onClick={() => setPreviewSkill(skill.type)}
                    >
                      <strong>{skill.shortLabel}</strong>
                      <span>{skill.description}</span>
                      {previewedSkills.has(skill.type) ? <Check size={15} /> : <BookOpen size={15} />}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="mw-stage-command">
            <span><Sparkles size={17} /> 已查看 {previewedSkills.size} / {MINIMUM_WINDOW_CHALLENGE.skills.length} 项技能</span>
            <button type="button" className="is-primary" onClick={() => { setHighestStage(2); setStage('program') }}>从空程序开始编排<ChevronRight size={17} /></button>
          </div>
        </section>
      )}

      {(stage === 'program' || stage === 'debug' || stage === 'verify') && (
        <section className="mw-workspace-stage">
          <div className="mw-phase-heading">
            <div>
              <span>{stage === 'program' ? '03 · 规则编排' : stage === 'debug' ? '04 · 调试执行' : '05 · 多批验证'}</span>
              <h2>{stage === 'program' ? '从空白程序搭出三层窗口规则' : stage === 'debug' ? '逐帧观察欠账和边界变化' : '用同一套程序校准三条文字带'}</h2>
            </div>
            <p>{stage === 'program' ? '控制技能提供可见作用域；动作必须放进正确的因果位置。' : currentBatch.name}</p>
          </div>

          <nav className="mw-mobile-pane-switch" aria-label="移动端工作区视图">
            <button type="button" className={mobilePane === 'scene' ? 'is-active' : ''} onClick={() => setMobilePane('scene')}><ScanLine size={15} />场景</button>
            <button type="button" className={mobilePane === 'program' ? 'is-active' : ''} onClick={() => setMobilePane('program')}><ListTree size={15} />程序</button>
          </nav>

          <div className={`mw-workspace mobile-pane-${mobilePane}`}>
            <div className="mw-scene-column">
              {(stage === 'debug' || stage === 'verify') && (
                <div className="mw-batch-tabs" role="tablist" aria-label="验证批次">
                  {MINIMUM_WINDOW_BATCHES.map((batch, index) => (
                    <button
                      key={batch.id}
                      type="button"
                      role="tab"
                      aria-selected={batchIndex === index}
                      className={batchIndex === index ? 'is-active' : ''}
                      onClick={() => { setBatchIndex(index); resetRun() }}
                      disabled={runtimeLocked}
                    >
                      <span>{index + 1}</span>{batch.name}{passedBatches.has(index) && <Check size={13} />}
                    </button>
                  ))}
                </div>
              )}
              <MinimumWindowBoard
                source={currentFrame.source}
                target={currentFrame.target}
                left={currentFrame.left}
                right={currentFrame.right}
                missing={currentFrame.missing}
                bestStart={currentFrame.bestStart}
                bestLength={currentFrame.bestLength}
                incomingCode={currentFrame.incomingCode}
                outgoingCode={currentFrame.outgoingCode}
                needEntries={currentFrame.needEntries}
              />
              <div className={`mw-runtime-message tone-${currentFrame.status}`} role="status">
                {currentFrame.status === 'error' ? <CircleAlert size={18} /> : currentFrame.status === 'success' ? <Check size={18} /> : <ScanLine size={18} />}
                <div><strong>{currentFrame.status === 'idle' ? '等待执行' : currentFrame.status === 'error' ? '规则停在这里' : currentFrame.status === 'success' ? '当前批次通过' : `执行帧 ${frameIndex + 1} / ${frames.length}`}</strong><p>{currentFrame.message}</p></div>
              </div>

              {stage !== 'program' && (
                <div className="mw-runtime-controls">
                  <button type="button" className="is-primary" onClick={play} disabled={program.length === 0}><span>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</span>{playing ? '暂停' : '播放'}</button>
                  <button type="button" onClick={step} disabled={playing || program.length === 0}><SkipForward size={17} />单步</button>
                  <button type="button" onClick={resetRun} disabled={frames.length === 0}><RotateCcw size={17} />重置</button>
                  <span>{frames.length === 0 ? '0 / 0' : `${frameIndex + 1} / ${frames.length}`}</span>
                </div>
              )}

              {stage === 'verify' && (
                <div className={`mw-suite-panel ${suiteCheck?.passed ? 'is-success' : suiteCheck ? 'is-error' : ''}`}>
                  <header>
                    <div><span>批次校准</span><strong>{passedBatches.size} / {MINIMUM_WINDOW_BATCHES.length}</strong></div>
                    <button
                      type="button"
                      onClick={suiteCheck?.passed ? resetVerification : verifyAll}
                      disabled={program.length === 0 || runtimeLocked}
                    >
                      {suiteCheck?.passed ? <RotateCcw size={17} /> : <FastForward size={17} />}
                      {suiteCheck?.passed ? '重新验证' : '校验全部批次'}
                    </button>
                  </header>
                  {suiteCheck?.passed && <p><Check size={16} /> 同一套窗口规则通过全部文字带，代码实战已解锁。</p>}
                  {suiteCheck && !suiteCheck.passed && firstFailedCheck && (
                    <div><CircleAlert size={16} /><span>第 {firstFailedIndex + 1} 批停在：{firstFailedCheck.result.error}</span><button type="button" onClick={() => { setBatchIndex(firstFailedIndex); setFrames(firstFailedCheck.result.frames); setFrameIndex(0) }}>查看执行</button></div>
                  )}
                  {allPassed && <button type="button" className="is-primary" onClick={goToCode}><Code2 size={17} />进入代码实战<ChevronRight size={16} /></button>}
                </div>
              )}
            </div>

            <aside className="mw-program-column">
              <MinimumWindowProgramBuilder
                program={program}
                activeNodeId={currentFrame.activeNodeId}
                disabled={runtimeLocked}
                onChange={updateProgram}
                onPreview={setPreviewSkill}
              />
              {stage === 'program' && (
                <div className={`mw-program-check ${programIssue ? 'is-error' : ''}`}>
                  <span>{programIssue ?? (program.length === 0 ? '程序保持空白；先从初始化技能开始。' : `当前已有 ${program.length} 个根节点。`)}</span>
                  <button type="button" className="is-primary" onClick={checkProgramStructure} disabled={program.length === 0}>检查并进入调试<ChevronRight size={17} /></button>
                </div>
              )}
              {stage === 'debug' && currentPassed && (
                <div className="mw-program-check is-success">
                  <span><Check size={16} /> 第一批真实执行通过，可以进入多批验证。</span>
                  <button type="button" className="is-primary" onClick={() => { setHighestStage((current) => Math.max(current, 4)); setStage('verify') }}>验证更多文字带<ChevronRight size={17} /></button>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      {previewSkill && (() => {
        const definition = getMinimumWindowSkill(previewSkill)
        const copy = skillPreviewCopy[previewSkill]
        return (
          <div className="mw-skill-preview" role="dialog" aria-modal="true" aria-labelledby="mw-preview-title">
            <button type="button" className="mw-preview-backdrop" onClick={() => setPreviewSkill(null)} aria-label="关闭技能预演" />
            <article>
              <header><div><span>{definition.createsScope ? '控制技能' : '动作技能'}</span><h2 id="mw-preview-title">{definition.label}</h2></div><button type="button" onClick={() => setPreviewSkill(null)} aria-label="关闭技能预演" title="关闭"><X size={18} /></button></header>
              <div className="mw-preview-signal"><span><ScanLine size={21} /></span><p>{definition.description}</p></div>
              <dl>
                <div><dt>前置状态</dt><dd>{copy.before}</dd></div>
                <div><dt>世界变化</dt><dd>{copy.effect}</dd></div>
                <div><dt>Java 映射</dt><dd><code>{copy.code}</code></dd></div>
              </dl>
              <footer><button type="button" className="is-primary" onClick={() => { setPreviewedSkills((current) => new Set([...current, previewSkill])); setPreviewSkill(null) }}><Check size={17} />预演完成</button></footer>
            </article>
          </div>
        )
      })()}
    </main>
  )
}
