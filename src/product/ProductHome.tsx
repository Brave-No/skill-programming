import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  Blocks,
  Braces,
  Check,
  Clock3,
  Code2,
  ImageOff,
  ListFilter,
  LockKeyhole,
  RotateCcw,
  Route,
  Wrench,
} from 'lucide-react'
import { ChallengeCompletion } from '../shared/completion'
import { RuleHintPreview } from './hints/RuleHintPreview'
import {
  CHALLENGE_CATALOG,
  DATA_STRUCTURE_LABELS,
  DIFFICULTY_LABELS,
  LANGUAGE_LABELS,
  LAST_CHALLENGE_KEY,
  STATUS_LABELS,
  TECHNIQUE_LABELS,
  TRACK_LABELS,
  type ChallengeCatalogEntryV2,
  type ChallengeDifficulty,
  type ChallengeStatus,
} from './challenges'

const readLastChallenge = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(LAST_CHALLENGE_KEY)
}

function ChallengePreview({ challenge }: { challenge: ChallengeCatalogEntryV2 }) {
  const [failed, setFailed] = useState(false)
  const previewAvailable = challenge.preview && !failed

  return (
    <div className={`challenge-preview ${previewAvailable ? '' : 'is-missing'}`}>
      {previewAvailable ? (
        <img
          src={challenge.preview!.src}
          alt={challenge.preview!.alt}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="preview-fallback" role="img" aria-label={`${challenge.worldTitle}暂无预览`}>
          <ImageOff size={25} />
          <span>预览准备中</span>
        </div>
      )}
      <span className="challenge-number" aria-hidden="true">
        {String(challenge.order).padStart(2, '0')}
      </span>
      <span className={`challenge-open-state state-${challenge.status}`}>
        <i />{STATUS_LABELS[challenge.status]}
      </span>
    </div>
  )
}

function ChallengeCardBody({
  challenge,
  isLastChallenge,
}: {
  challenge: ChallengeCatalogEntryV2
  isLastChallenge: boolean
}) {
  const prerequisites = challenge.prerequisiteIds
    .map((id) => CHALLENGE_CATALOG.find((entry) => entry.id === id)?.worldTitle)
    .filter(Boolean)

  return (
    <article>
      <ChallengePreview challenge={challenge} />
      <div className="challenge-body">
        <div className="challenge-title-row">
          <div>
            <p>{challenge.algorithmTitle}</p>
            <h3>{challenge.worldTitle}</h3>
          </div>
          {isLastChallenge && <span className="last-played">上次进入</span>}
        </div>
        <p className="challenge-summary">{challenge.summary}</p>
        <div className="challenge-taxonomy" aria-label="学习分类">
          <b>{TRACK_LABELS[challenge.trackId]}</b>
          {challenge.dataStructureIds.map((id) => <span key={id}>{DATA_STRUCTURE_LABELS[id]}</span>)}
          {challenge.techniqueIds.map((id) => <span key={id}>{TECHNIQUE_LABELS[id]}</span>)}
        </div>
        <dl className="challenge-meta">
          <div><dt>难度</dt><dd>{DIFFICULTY_LABELS[challenge.difficulty]}</dd></div>
          <div><dt>流程</dt><dd>{challenge.stageCount} 阶段</dd></div>
          <div><dt>时间</dt><dd>{challenge.estimatedMinutes} 分钟</dd></div>
          <div><dt>语言</dt><dd>{challenge.languageIds.map((id) => LANGUAGE_LABELS[id]).join(' / ')}</dd></div>
        </dl>
        {challenge.status === 'available' ? (
          <span className="challenge-launch">
            {isLastChallenge ? '继续挑战' : '开始挑战'}
            <ArrowRight size={19} />
          </span>
        ) : (
          <span className="challenge-launch is-disabled">
            {challenge.status === 'locked' ? (
              <><LockKeyhole size={17} />先完成 {prerequisites.join('、')}</>
            ) : (
              <><Wrench size={17} />开发完成后开放</>
            )}
          </span>
        )}
      </div>
    </article>
  )
}

function ChallengeCard({
  challenge,
  isLastChallenge,
  onEnter,
}: {
  challenge: ChallengeCatalogEntryV2
  isLastChallenge: boolean
  onEnter: () => void
}) {
  const className = `challenge-card accent-${challenge.accent} status-${challenge.status}`
  const content: ReactNode = (
    <ChallengeCardBody challenge={challenge} isLastChallenge={isLastChallenge} />
  )
  if (challenge.status === 'available' && challenge.route) {
    return (
      <a
        className={className}
        href={challenge.route}
        onClick={onEnter}
        data-challenge-id={challenge.id}
      >
        {content}
      </a>
    )
  }
  return (
    <section className={className} data-challenge-id={challenge.id} aria-label={`${challenge.worldTitle}，${STATUS_LABELS[challenge.status]}`}>
      {content}
    </section>
  )
}

export function ProductHome() {
  const [showRuleHintPreview] = useState(() => (
    typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('hint') === 'preview'
  ))
  const [lastChallenge, setLastChallenge] = useState<string | null>(readLastChallenge)
  const [showCompletionPreview, setShowCompletionPreview] = useState(() => (
    typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('celebration') === 'preview'
  ))
  const [trackFilter, setTrackFilter] = useState('all')
  const [dataStructureFilter, setDataStructureFilter] = useState('all')
  const [techniqueFilter, setTechniqueFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | ChallengeDifficulty>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ChallengeStatus>('all')
  const availableCount = CHALLENGE_CATALOG.filter(({ status }) => status === 'available').length
  const trackCount = new Set(CHALLENGE_CATALOG.map(({ trackId }) => trackId)).size
  const trackOptions = Object.keys(TRACK_LABELS).filter((id) => CHALLENGE_CATALOG.some(({ trackId }) => trackId === id))
  const dataStructureOptions = Object.keys(DATA_STRUCTURE_LABELS).filter((id) => (
    CHALLENGE_CATALOG.some(({ dataStructureIds }) => dataStructureIds.includes(id))
  ))
  const techniqueOptions = Object.keys(TECHNIQUE_LABELS).filter((id) => (
    CHALLENGE_CATALOG.some(({ techniqueIds }) => techniqueIds.includes(id))
  ))
  const filteredChallenges = useMemo(() => CHALLENGE_CATALOG
    .filter((challenge) => trackFilter === 'all' || challenge.trackId === trackFilter)
    .filter((challenge) => dataStructureFilter === 'all' || challenge.dataStructureIds.includes(dataStructureFilter))
    .filter((challenge) => techniqueFilter === 'all' || challenge.techniqueIds.includes(techniqueFilter))
    .filter((challenge) => difficultyFilter === 'all' || challenge.difficulty === difficultyFilter)
    .filter((challenge) => statusFilter === 'all' || challenge.status === statusFilter)
    .sort((left, right) => left.order - right.order), [dataStructureFilter, difficultyFilter, statusFilter, techniqueFilter, trackFilter])
  const challengeGroups = useMemo(() => {
    const groups = new Map<string, ChallengeCatalogEntryV2[]>()
    filteredChallenges.forEach((challenge) => {
      groups.set(challenge.trackId, [...(groups.get(challenge.trackId) ?? []), challenge])
    })
    return [...groups.entries()]
  }, [filteredChallenges])
  const hasActiveFilters = trackFilter !== 'all'
    || dataStructureFilter !== 'all'
    || techniqueFilter !== 'all'
    || difficultyFilter !== 'all'
    || statusFilter !== 'all'

  const rememberChallenge = (challengeId: string) => {
    window.localStorage.setItem(LAST_CHALLENGE_KEY, challengeId)
    setLastChallenge(challengeId)
  }

  if (showRuleHintPreview) return <RuleHintPreview />

  return (
    <div className="catalog-shell">
      {showCompletionPreview && (
        <ChallengeCompletion
          passedCount={12}
          total={12}
          onClose={() => setShowCompletionPreview(false)}
        />
      )}
      <header className="catalog-topbar">
        <a className="catalog-brand" href="/" aria-label="技能编程挑战选择">
          <span aria-hidden="true"><Braces size={22} /></span>
          <strong>技能编程</strong>
        </a>
        <div className="catalog-availability" aria-label={`${availableCount} 个挑战可用`}>
          <span><Check size={13} /></span>
          {availableCount} 个挑战可用
        </div>
      </header>

      <main className="catalog-main">
        <section className="catalog-intro" aria-labelledby="catalog-title">
          <div>
            <p className="catalog-kicker">算法挑战目录</p>
            <h1 id="catalog-title">技能编程</h1>
            <p className="catalog-lede">选择一个算法世界，从动手理解一路挑战到真实代码。</p>
          </div>
          <div className="catalog-flow" aria-label="挑战流程">
            <span><Blocks size={17} />动手与编排</span>
            <i aria-hidden="true" />
            <span><Route size={17} />调试与验证</span>
            <i aria-hidden="true" />
            <span><Code2 size={17} />Java 实战</span>
          </div>
        </section>

        <section className="challenge-library" aria-labelledby="challenge-library-title">
          <div className="library-heading">
            <div>
              <p>CHALLENGE LIBRARY</p>
              <h2 id="challenge-library-title">选择挑战</h2>
            </div>
            <span><Clock3 size={14} /> {CHALLENGE_CATALOG.length} 道题 · {trackCount} 个学习专题</span>
          </div>

          <div className="catalog-filters" aria-label="挑战筛选">
            <span><ListFilter size={16} />筛选</span>
            <label>
              <span>学习专题</span>
              <select value={trackFilter} onChange={(event) => setTrackFilter(event.target.value)}>
                <option value="all">全部专题</option>
                {trackOptions.map((id) => <option key={id} value={id}>{TRACK_LABELS[id]}</option>)}
              </select>
            </label>
            <label>
              <span>数据结构</span>
              <select value={dataStructureFilter} onChange={(event) => setDataStructureFilter(event.target.value)}>
                <option value="all">全部结构</option>
                {dataStructureOptions.map((id) => <option key={id} value={id}>{DATA_STRUCTURE_LABELS[id]}</option>)}
              </select>
            </label>
            <label>
              <span>难度</span>
              <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value as 'all' | ChallengeDifficulty)}>
                <option value="all">全部难度</option>
                {(Object.keys(DIFFICULTY_LABELS) as ChallengeDifficulty[]).map((id) => <option key={id} value={id}>{DIFFICULTY_LABELS[id]}</option>)}
              </select>
            </label>
            <label>
              <span>解题技巧</span>
              <select value={techniqueFilter} onChange={(event) => setTechniqueFilter(event.target.value)}>
                <option value="all">全部技巧</option>
                {techniqueOptions.map((id) => <option key={id} value={id}>{TECHNIQUE_LABELS[id]}</option>)}
              </select>
            </label>
            <label>
              <span>开放状态</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ChallengeStatus)}>
                <option value="all">全部状态</option>
                {(Object.keys(STATUS_LABELS) as ChallengeStatus[]).map((id) => <option key={id} value={id}>{STATUS_LABELS[id]}</option>)}
              </select>
            </label>
            <strong>{filteredChallenges.length} 道结果</strong>
            <button
              type="button"
              onClick={() => { setTrackFilter('all'); setDataStructureFilter('all'); setTechniqueFilter('all'); setDifficultyFilter('all'); setStatusFilter('all') }}
              disabled={!hasActiveFilters}
            >
              <RotateCcw size={15} />清除筛选
            </button>
          </div>

          {challengeGroups.length ? challengeGroups.map(([trackId, challenges]) => (
            <section className="challenge-track-group" key={trackId} aria-labelledby={`track-${trackId}`}>
              <header>
                <div><p>LEARNING TRACK</p><h3 id={`track-${trackId}`}>{TRACK_LABELS[trackId]}</h3></div>
                <span>{challenges.length} 道挑战</span>
              </header>
              <div className="challenge-grid">
                {challenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    isLastChallenge={lastChallenge === challenge.id}
                    onEnter={() => rememberChallenge(challenge.id)}
                  />
                ))}
              </div>
            </section>
          )) : (
            <div className="catalog-empty-result" role="status">
              <ListFilter size={22} />
              <strong>没有符合当前筛选的挑战</strong>
              <button type="button" onClick={() => { setTrackFilter('all'); setDataStructureFilter('all'); setTechniqueFilter('all'); setDifficultyFilter('all'); setStatusFilter('all') }}>清除筛选</button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
