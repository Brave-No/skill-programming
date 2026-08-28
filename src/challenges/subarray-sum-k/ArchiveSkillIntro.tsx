import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  Database,
  ListRestart,
  Play,
  Repeat2,
  Sigma,
  X,
} from 'lucide-react'
import { getArchiveSkill, type ArchiveSkillType } from './model'

interface ArchiveSkillIntroProps {
  skillType: ArchiveSkillType
  onClose: () => void
}

const outcome: Record<ArchiveSkillType, string> = {
  'initialize-archive': '空前缀 0 已登记 1 次，累计刻度与命中计数归零。',
  'scan-values': '探针在到达数组长度前，逐站重复执行内部规则。',
  'accumulate-prefix': '累计刻度 1 + 当前变化 -1 = 0。',
  'count-matches': '先算出目标旧刻度，再把它的 2 份历史档案计入答案。',
  'record-prefix': '当前刻度 0 的档案次数从 2 更新为 3。',
}

function SkillGlyph({ type }: { type: ArchiveSkillType }) {
  switch (type) {
    case 'initialize-archive': return <Archive size={21} />
    case 'scan-values': return <Repeat2 size={21} />
    case 'accumulate-prefix': return <Sigma size={21} />
    case 'count-matches': return <Database size={21} />
    case 'record-prefix': return <ListRestart size={21} />
  }
}

export default function ArchiveSkillIntro({ skillType, onClose }: ArchiveSkillIntroProps) {
  const [runId, setRunId] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const definition = getArchiveSkill(skillType)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="archive-intro-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="archive-intro" role="dialog" aria-modal="true" aria-labelledby="archive-intro-title">
        <header>
          <span className={`tone-${definition.tone}`}><SkillGlyph type={skillType} /></span>
          <div><small>技能预演</small><h2 id="archive-intro-title">{definition.label}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭技能预演" title="关闭"><X size={20} /></button>
        </header>
        <div key={`${skillType}-${runId}`} className={`archive-intro-stage intro-${skillType}`} data-concept-ids={definition.conceptIds.join(' ')}>
          <div className="intro-values"><span>1</span><span>-1</span><span>0</span></div>
          <div className="intro-equation"><b>prefix</b><strong>1</strong><i>→</i><strong>0</strong></div>
          <div className="intro-ledger"><span>0</span><b>2 → 3</b></div>
          <div className="intro-count"><small>count</small><strong>1 → 3</strong></div>
          <span className="intro-progress"><i /></span>
        </div>
        <footer>
          <div><p>{definition.worldAction}</p><strong>{outcome[skillType]}</strong></div>
          <button type="button" onClick={() => setRunId((value) => value + 1)} aria-label="重新播放技能预演" title="重新播放"><Play size={19} fill="currentColor" /></button>
        </footer>
      </section>
    </div>
  )
}
