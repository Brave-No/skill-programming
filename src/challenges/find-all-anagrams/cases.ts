export interface AnagramInput {
  source: string
  pattern: string
}

export interface AnagramVerificationBatch {
  id: string
  name: string
  input: AnagramInput
  expected: number[]
}

export interface AnagramCodeCase extends AnagramVerificationBatch {
  label: string
  visibility: 'public' | 'hidden'
}

export const findAnagramIndices = ({ source, pattern }: AnagramInput): number[] => {
  if (pattern.length === 0 || pattern.length > source.length) return []
  const target = Array(26).fill(0)
  const window = Array(26).fill(0)
  for (const character of pattern) target[character.charCodeAt(0) - 97] += 1

  const result: number[] = []
  let left = 0
  for (let right = 0; right < source.length; right += 1) {
    window[source.charCodeAt(right) - 97] += 1
    if (right - left + 1 > pattern.length) {
      window[source.charCodeAt(left) - 97] -= 1
      left += 1
    }
    if (
      right - left + 1 === pattern.length
      && target.every((count, index) => count === window[index])
    ) result.push(left)
  }
  return result
}

export const ANAGRAM_BATCHES: AnagramVerificationBatch[] = [
  {
    id: 'separated-matches',
    name: '双峰信号带',
    input: { source: 'cbaebabacd', pattern: 'abc' },
    expected: [0, 6],
  },
  {
    id: 'overlapping-matches',
    name: '连续重叠带',
    input: { source: 'abab', pattern: 'ab' },
    expected: [0, 1, 2],
  },
  {
    id: 'repeated-letter',
    name: '重复字母带',
    input: { source: 'baa', pattern: 'aa' },
    expected: [1],
  },
]

const hiddenInputs: AnagramInput[] = [
  { source: 'a', pattern: 'a' },
  { source: 'aaaaaaaa', pattern: 'aa' },
  { source: 'abc', pattern: 'abcd' },
  { source: 'abcdefg', pattern: 'hij' },
  { source: 'abababab', pattern: 'aab' },
  { source: 'abcdecba', pattern: 'abc' },
]

export const ANAGRAM_CODE_CASES: AnagramCodeCase[] = [
  ...ANAGRAM_BATCHES.map((batch, index) => ({
    ...batch,
    id: `public-${index + 1}`,
    label: batch.name,
    visibility: 'public' as const,
  })),
  ...hiddenInputs.map((input, index) => ({
    id: `hidden-${index + 1}`,
    name: '隐藏信号带',
    label: `隐藏边界 ${index + 1}`,
    input,
    expected: findAnagramIndices(input),
    visibility: 'hidden' as const,
  })),
]
