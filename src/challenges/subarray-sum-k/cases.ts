export interface ArchiveBatch {
  id: string
  name: string
  values: number[]
  target: number
  expected: number
}

export interface ArchiveCodeInput {
  nums: number[]
  k: number
}

export const countTargetSubarrays = (values: number[], target: number) => {
  let count = 0
  for (let start = 0; start < values.length; start += 1) {
    let sum = 0
    for (let end = start; end < values.length; end += 1) {
      sum += values[end]
      if (sum === target) count += 1
    }
  }
  return count
}

export const ARCHIVE_BATCHES: ArchiveBatch[] = [
  { id: 'repeated-positive', name: '第一卷 · 重复正数', values: [1, 1, 1], target: 2, expected: 2 },
  { id: 'overlapping-ranges', name: '第二卷 · 交叠区间', values: [1, 2, 3], target: 3, expected: 2 },
  { id: 'zero-and-negative', name: '第三卷 · 零与负数', values: [1, -1, 0], target: 0, expected: 3 },
]

export const ARCHIVE_CODE_CASES = [
  { id: 'public-repeated', label: '重复正数', input: { nums: [1, 1, 1], k: 2 }, expected: 2, visibility: 'public' as const },
  { id: 'public-overlap', label: '交叠区间', input: { nums: [1, 2, 3], k: 3 }, expected: 2, visibility: 'public' as const },
  { id: 'public-zero-negative', label: '零与负数', input: { nums: [1, -1, 0], k: 0 }, expected: 3, visibility: 'public' as const },
  { id: 'hidden-single-hit', label: '单站命中', input: { nums: [5], k: 5 }, expected: 1, visibility: 'hidden' as const },
  { id: 'hidden-single-miss', label: '单站未命中', input: { nums: [4], k: 5 }, expected: 0, visibility: 'hidden' as const },
  { id: 'hidden-repeat-zero', label: '重复零刻度', input: { nums: [0, 0, 0], k: 0 }, expected: 6, visibility: 'hidden' as const },
  { id: 'hidden-negative-target', label: '负目标', input: { nums: [-1, -1, 1], k: -1 }, expected: 3, visibility: 'hidden' as const },
  { id: 'hidden-empty', label: '空数值带', input: { nums: [], k: 0 }, expected: 0, visibility: 'hidden' as const },
  { id: 'hidden-classic', label: '经典长例', input: { nums: [3, 4, 7, 2, -3, 1, 4, 2], k: 7 }, expected: 4, visibility: 'hidden' as const },
]
