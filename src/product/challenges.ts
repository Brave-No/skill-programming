export type ChallengeAccent = 'warehouse' | 'rainline' | 'prefix' | 'window' | 'spectrum' | 'corridor'
export type ChallengeDifficulty = 'intro' | 'intermediate' | 'challenge'
export type ChallengeStatus = 'available' | 'coming-soon' | 'locked'

export interface ChallengePreview {
  src: string
  alt: string
}

export interface ChallengeCatalogEntryV2 {
  id: string
  order: number
  worldTitle: string
  algorithmTitle: string
  summary: string
  trackId: string
  dataStructureIds: string[]
  techniqueIds: string[]
  difficulty: ChallengeDifficulty
  status: ChallengeStatus
  languageIds: string[]
  stageCount: number
  estimatedMinutes: number
  prerequisiteIds: string[]
  preview: ChallengePreview | null
  route: string | null
  accent: ChallengeAccent
}

export const TRACK_LABELS: Record<string, string> = {
  'two-pointers': '双指针入门',
  'sliding-window': '滑动窗口',
  'prefix-sum': '前缀和',
}

export const DATA_STRUCTURE_LABELS: Record<string, string> = {
  array: '数组',
  string: '字符串',
  'frequency-table': '频次表',
  'hash-map': '哈希表',
}

export const TECHNIQUE_LABELS: Record<string, string> = {
  'fast-slow-pointers': '快慢指针',
  'two-ended-pointers': '双端指针',
  'variable-window': '可变窗口',
  'frequency-accounting': '频次记账',
  'fixed-window': '固定窗口',
  'prefix-frequency': '前缀和计数',
}

export const DIFFICULTY_LABELS: Record<ChallengeDifficulty, string> = {
  intro: '入门',
  intermediate: '进阶',
  challenge: '挑战',
}

export const STATUS_LABELS: Record<ChallengeStatus, string> = {
  available: '已开放',
  'coming-soon': '开发中',
  locked: '待解锁',
}

export const LANGUAGE_LABELS: Record<string, string> = {
  java: 'Java',
}

export const CHALLENGE_CATALOG: ChallengeCatalogEntryV2[] = [
  {
    id: 'move-zeroes',
    order: 1,
    worldTitle: '零号仓库',
    algorithmTitle: '移动零',
    summary: '调度两台机器人整理货位，让货箱保持顺序并把空位移到末端。',
    trackId: 'two-pointers',
    dataStructureIds: ['array'],
    techniqueIds: ['fast-slow-pointers'],
    difficulty: 'intro',
    status: 'available',
    languageIds: ['java'],
    stageCount: 6,
    estimatedMinutes: 25,
    prerequisiteIds: [],
    route: '/games/zero-warehouse/',
    preview: {
      src: '/previews/zero-warehouse.png',
      alt: '零号仓库的双机器人货位与技能编排界面',
    },
    accent: 'warehouse',
  },
  {
    id: 'trapping-rain-water',
    order: 2,
    worldTitle: '雨线峡谷',
    algorithmTitle: '接雨水',
    summary: '派出两名巡线员读取岸线高度，从两端判断并结算峡谷积水。',
    trackId: 'two-pointers',
    dataStructureIds: ['array'],
    techniqueIds: ['two-ended-pointers'],
    difficulty: 'intermediate',
    status: 'available',
    languageIds: ['java'],
    stageCount: 6,
    estimatedMinutes: 35,
    prerequisiteIds: [],
    route: '/games/rainline/',
    preview: {
      src: '/previews/rainline.png',
      alt: '雨线峡谷的地形观察与巡检技能编排界面',
    },
    accent: 'rainline',
  },
  {
    id: 'minimum-window-substring',
    order: 3,
    worldTitle: '窗口校准台',
    algorithmTitle: '最小覆盖子串',
    summary: '在连续文字带上扩张与收缩窗口，用字符欠账锁定最短完整片段。',
    trackId: 'sliding-window',
    dataStructureIds: ['string', 'frequency-table'],
    techniqueIds: ['variable-window', 'frequency-accounting'],
    difficulty: 'challenge',
    status: 'available',
    languageIds: ['java'],
    stageCount: 6,
    estimatedMinutes: 45,
    prerequisiteIds: [],
    route: '/games/minimum-window/',
    preview: {
      src: '/previews/minimum-window.png',
      alt: '窗口校准台的文字扫描带、字符欠账和技能编排界面',
    },
    accent: 'window',
  },
  {
    id: 'subarray-sum-k',
    order: 4,
    worldTitle: '前缀和档案站',
    algorithmTitle: '和为 K 的子数组',
    summary: '沿数值带维护累计刻度，用历史前缀频次找出所有和为 K 的连续区间。',
    trackId: 'prefix-sum',
    dataStructureIds: ['array', 'hash-map'],
    techniqueIds: ['prefix-frequency'],
    difficulty: 'intermediate',
    status: 'available',
    languageIds: ['java'],
    stageCount: 6,
    estimatedMinutes: 35,
    prerequisiteIds: [],
    route: '/games/subarray-sum-k/',
    preview: {
      src: '/previews/subarray-sum-k.png',
      alt: '前缀和档案站的数值带、累计刻度与历史前缀档案柜',
    },
    accent: 'prefix',
  },
  {
    id: 'find-all-anagrams',
    order: 5,
    worldTitle: '频谱滑窗站',
    algorithmTitle: '找到字符串中所有字母异位词',
    summary: '维护与目标等宽的字母频谱窗口，找出源字符串中所有完整同频片段。',
    trackId: 'sliding-window',
    dataStructureIds: ['string', 'frequency-table'],
    techniqueIds: ['fixed-window', 'frequency-accounting'],
    difficulty: 'intermediate',
    status: 'available',
    languageIds: ['java'],
    stageCount: 6,
    estimatedMinutes: 40,
    prerequisiteIds: [],
    route: '/games/find-all-anagrams/',
    preview: {
      src: '/previews/find-all-anagrams.png',
      alt: '频谱滑窗站的源信号带、双频谱与固定窗口技能编排界面',
    },
    accent: 'spectrum',
  },
  {
    id: 'longest-substring-without-repeating-characters',
    order: 6,
    worldTitle: '字符灯廊',
    algorithmTitle: '无重复字符的最长子串',
    summary: '让右侧扫描头探索字符带，重复时移动左边界，维持最长的无重复连续窗口。',
    trackId: 'sliding-window',
    dataStructureIds: ['string', 'frequency-table'],
    techniqueIds: ['variable-window', 'frequency-accounting'],
    difficulty: 'intermediate',
    status: 'available',
    languageIds: ['java'],
    stageCount: 6,
    estimatedMinutes: 35,
    prerequisiteIds: [],
    route: '/games/character-corridor/',
    preview: {
      src: '/previews/character-corridor.png',
      alt: '字符灯廊的字符轨道、窗口边界、频次台与技能编排界面',
    },
    accent: 'corridor',
  },
]

export const LAST_CHALLENGE_KEY = 'skill-programming:last-challenge:v1'

export const validateChallengeCatalog = (
  entries: ChallengeCatalogEntryV2[],
): string[] => {
  const issues: string[] = []
  const ids = new Set<string>()
  const orders = new Set<number>()
  const routes = new Set<string>()

  for (const entry of entries) {
    if (ids.has(entry.id)) issues.push(`${entry.id}: challenge id 重复。`)
    ids.add(entry.id)
    if (orders.has(entry.order)) issues.push(`${entry.id}: 排序号 ${entry.order} 重复。`)
    orders.add(entry.order)
    if (!TRACK_LABELS[entry.trackId]) issues.push(`${entry.id}: 学习专题不存在。`)
    if (entry.dataStructureIds.some((id) => !DATA_STRUCTURE_LABELS[id])) {
      issues.push(`${entry.id}: 包含未登记的数据结构。`)
    }
    if (entry.techniqueIds.some((id) => !TECHNIQUE_LABELS[id])) {
      issues.push(`${entry.id}: 包含未登记的解题技巧。`)
    }
    if (entry.languageIds.length === 0 || entry.languageIds.some((id) => !LANGUAGE_LABELS[id])) {
      issues.push(`${entry.id}: 目标语言无效。`)
    }
    if (entry.stageCount < 1 || entry.estimatedMinutes < 1) {
      issues.push(`${entry.id}: 阶段数和预计时长必须为正数。`)
    }
    if (entry.status === 'available') {
      if (!entry.route?.startsWith('/games/')) issues.push(`${entry.id}: 已开放关卡缺少可达路径。`)
      if (!entry.preview?.src || !entry.preview.alt) issues.push(`${entry.id}: 已开放关卡缺少真实预览。`)
    }
    if (entry.status !== 'available' && entry.route !== null) {
      issues.push(`${entry.id}: 非开放关卡不能提供可玩路径。`)
    }
    if (entry.status === 'locked' && entry.prerequisiteIds.length === 0) {
      issues.push(`${entry.id}: 锁定关卡缺少前置条件。`)
    }
    if (entry.route) {
      if (routes.has(entry.route)) issues.push(`${entry.id}: 页面路径重复。`)
      routes.add(entry.route)
    }
  }

  for (const entry of entries) {
    entry.prerequisiteIds.forEach((id) => {
      if (!ids.has(id)) issues.push(`${entry.id}: 前置关卡 ${id} 不存在。`)
    })
  }
  return issues
}
