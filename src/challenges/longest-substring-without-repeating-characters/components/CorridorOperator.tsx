export type CorridorOperatorKind = 'keeper' | 'scout'

type CorridorOperatorState = 'idle' | 'guarding' | 'clearing' | 'patrolling' | 'reading' | 'moving' | 'complete'

interface CorridorOperatorProps {
  kind: CorridorOperatorKind
  state?: CorridorOperatorState
  compact?: boolean
}

const OPERATOR_COPY: Record<CorridorOperatorKind, { label: string; state: Record<CorridorOperatorState, string> }> = {
  keeper: {
    label: '守窗员',
    state: {
      idle: '等待窗口就位',
      guarding: '守住无重复窗口左缘',
      clearing: '清退左端重复字符',
      patrolling: '守住无重复窗口左缘',
      reading: '守住无重复窗口左缘',
      moving: '向右收紧窗口边界',
      complete: '完成边界守卫',
    },
  },
  scout: {
    label: '巡灯员',
    state: {
      idle: '等待开始巡查',
      guarding: '等待开始巡查',
      clearing: '等待守窗员清退重复字符',
      patrolling: '沿字符轨道向右巡查',
      reading: '用探照灯读取当前字符',
      moving: '前往下一格字符',
      complete: '已经抵达字符轨道末端',
    },
  },
}

function KeeperGlyph() {
  return (
    <svg viewBox="0 0 72 54" aria-hidden="true">
      <path d="M8 8v38M8 13h15M8 24h15M8 35h15" className="corridor-operator__gate" />
      <path d="M24 14h31l7 9v22H24z" className="corridor-operator__body" />
      <path d="M29 20h22v12H29z" className="corridor-operator__visor" />
      <circle cx="35" cy="26" r="2.4" className="corridor-operator__eye" />
      <circle cx="45" cy="26" r="2.4" className="corridor-operator__eye" />
      <path d="M24 31 14 27M60 31h6v9h-6M31 45v5M53 45v5" className="corridor-operator__line" />
      <path d="M4 46h63" className="corridor-operator__ground" />
    </svg>
  )
}

function ScoutGlyph() {
  return (
    <svg viewBox="0 0 72 54" aria-hidden="true">
      <path d="m55 22 15-8v20z" className="corridor-operator__beam" />
      <path d="M17 15h37l6 9v20H17z" className="corridor-operator__body" />
      <path d="M24 21h25v12H24z" className="corridor-operator__visor" />
      <path d="M36 15V7m0 0 7 4m-7-4-7 4" className="corridor-operator__line" />
      <circle cx="43" cy="27" r="3.2" className="corridor-operator__lens" />
      <path d="M12 44h52M24 44v5M53 44v5M17 34 9 39M60 33l6 4" className="corridor-operator__line" />
      <circle cx="9" cy="39" r="3" className="corridor-operator__signal" />
    </svg>
  )
}

export default function CorridorOperator({ kind, state = 'idle', compact = false }: CorridorOperatorProps) {
  const copy = OPERATOR_COPY[kind]

  return (
    <span
      className={`corridor-operator corridor-operator--${kind} state-${state} ${compact ? 'is-compact' : ''}`}
      role="img"
      aria-label={`${copy.label}，${copy.state[state]}`}
    >
      <span className="corridor-operator__tag">{copy.label}</span>
      {kind === 'keeper' ? <KeeperGlyph /> : <ScoutGlyph />}
    </span>
  )
}
