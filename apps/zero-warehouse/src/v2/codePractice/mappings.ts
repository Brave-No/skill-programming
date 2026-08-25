export type MappingCategory = 'scene-object' | 'skill-action' | 'syntax' | 'api-method'

export interface MappingSnippet {
  languageId: string
  label: string
  code: string
}

export interface CodeMappingEntry {
  id: string
  category: MappingCategory
  label: string
  description: string
  snippets: MappingSnippet[]
  patterns: string[]
}

export interface LanguageMapping {
  languageId: string
  label: string
  entries: CodeMappingEntry[]
}

export const MAPPING_CATEGORY_LABELS: Record<MappingCategory, string> = {
  'scene-object': '场景对象',
  'skill-action': '技能动作',
  syntax: '语法结构',
  'api-method': '数据结构 / API',
}

const java = (code: string): MappingSnippet => ({
  languageId: 'java',
  label: 'Java',
  code,
})

export const JAVA_MAPPING_ENTRIES: CodeMappingEntry[] = [
  {
    id: 'scene-warehouse-slots',
    category: 'scene-object',
    label: '仓库货位',
    description: '一排固定长度的货位，在代码里作为可读写的整数数组。',
    snippets: [java('int[] nums')],
    patterns: ['\\bint\\s*\\[\\s*\\]\\s+nums\\b', '\\bnums\\b'],
  },
  {
    id: 'scene-empty-slot',
    category: 'scene-object',
    label: '空位',
    description: '数字 0 表示当前货位没有货箱。',
    snippets: [java('nums[index] == 0')],
    patterns: ['(?:==|!=)\\s*0\\b', '\\b0\\b'],
  },
  {
    id: 'scene-load-hand',
    category: 'scene-object',
    label: '装载手',
    description: '慢指针记录下一个应该落货的位置。',
    snippets: [java('int writeIndex')],
    patterns: ['\\bwriteIndex\\b'],
  },
  {
    id: 'scene-scan-hand',
    category: 'scene-object',
    label: '扫描手',
    description: '快指针记录正在检查的货位。',
    snippets: [java('int scanIndex')],
    patterns: ['\\bscanIndex\\b'],
  },
  {
    id: 'skill-locate-write',
    category: 'skill-action',
    label: '定位装载手',
    description: '先把装载位置放到数组的起点。',
    snippets: [java('int writeIndex = 0;')],
    patterns: ['\\bwriteIndex\\b\\s*=\\s*0'],
  },
  {
    id: 'skill-traverse',
    category: 'skill-action',
    label: '逐个遍历',
    description: '扫描手从第一个货位走到数组末端。',
    snippets: [java('for (int scanIndex = 0; scanIndex < nums.length; scanIndex++)')],
    patterns: ['\\bfor\\s*\\('],
  },
  {
    id: 'skill-check-occupied',
    category: 'skill-action',
    label: '判断有货',
    description: '只在当前扫描货位不是 0 时进入搬运动作。',
    snippets: [java('if (nums[scanIndex] != 0)')],
    patterns: ['\\bif\\s*\\('],
  },
  {
    id: 'skill-swap',
    category: 'skill-action',
    label: '交换货箱',
    description: '借助临时变量，让扫描手和装载手完成一次交换。',
    snippets: [java('int temp = nums[scanIndex];')],
    patterns: ['\\btemp\\b', 'nums\\s*\\[[^\\]]+\\]\\s*='],
  },
  {
    id: 'skill-advance-write',
    category: 'skill-action',
    label: '装载手前进',
    description: '成功落货后，慢指针只前进一步。',
    snippets: [java('writeIndex++;')],
    patterns: ['\\bwriteIndex\\b\\s*(?:\\+\\+|\\+=)'],
  },
  {
    id: 'syntax-array-access',
    category: 'syntax',
    label: '数组访问',
    description: '用方括号读写指定货位。',
    snippets: [java('nums[scanIndex]')],
    patterns: ['\\bnums\\s*\\[[^\\]]+\\]'],
  },
  {
    id: 'syntax-length',
    category: 'syntax',
    label: '长度读取',
    description: '数组的 length 表示货位总数。',
    snippets: [java('nums.length')],
    patterns: ['\\.length\\b'],
  },
  {
    id: 'syntax-declaration',
    category: 'syntax',
    label: '变量声明',
    description: '用 int 声明计数器、指针和临时货箱。',
    snippets: [java('int temp;')],
    patterns: ['\\bint(?:\\s*\\[\\s*\\])?\\s+[A-Za-z_]\\w*'],
  },
  {
    id: 'syntax-comparison',
    category: 'syntax',
    label: '比较',
    description: '比较货位内容或指针是否到达边界。',
    snippets: [java('nums[scanIndex] != 0')],
    patterns: ['(?:==|!=|<=|>=|<|>)'],
  },
  {
    id: 'syntax-increment',
    category: 'syntax',
    label: '自增',
    description: '让扫描手或装载手移动一个货位。',
    snippets: [java('scanIndex++')],
    patterns: ['\\+\\+|\\+=\\s*1'],
  },
  {
    id: 'api-array-length',
    category: 'api-method',
    label: '数组 length',
    description: '本关允许使用的数组内建属性，用来读取遍历边界。',
    snippets: [java('nums.length')],
    patterns: ['\\.length\\b'],
  },
]

export const JAVA_MAPPING: LanguageMapping = {
  languageId: 'java',
  label: 'Java',
  entries: JAVA_MAPPING_ENTRIES,
}

export const FUTURE_MAPPING_EXAMPLE: CodeMappingEntry = {
  id: 'api-map-put',
  category: 'api-method',
  label: 'Map.put',
  description: '未来数据结构关卡可将 Map.put 作为独立 API 技能接入。',
  snippets: [java('map.put(key, value);')],
  patterns: ['\\.put\\s*\\('],
}

// The product starts with an empty method body. The complete solution lives only in QA fixtures.
export const EMPTY_JAVA_BODY = ''

export const MAPPING_CATEGORY_ORDER: MappingCategory[] = [
  'scene-object',
  'skill-action',
  'syntax',
  'api-method',
]

export const analyzeMappingOccurrences = (
  code: string,
  entries: CodeMappingEntry[] = JAVA_MAPPING_ENTRIES,
) => {
  const lines = code.split(/\r?\n/)
  const occurrences = new Map<string, number[]>()

  for (const entry of entries) {
    const lineNumbers: number[] = []
    const expressions = entry.patterns.map((pattern) => new RegExp(pattern))
    lines.forEach((line, index) => {
      if (expressions.some((expression) => expression.test(line))) lineNumbers.push(index + 1)
    })
    occurrences.set(entry.id, lineNumbers)
  }

  return occurrences
}
