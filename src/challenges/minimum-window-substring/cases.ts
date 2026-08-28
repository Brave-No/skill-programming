export interface MinimumWindowInput {
  source: string
  target: string
}

export interface MinimumWindowVerificationBatch extends MinimumWindowInput {
  id: string
  name: string
  expected: string
}

export interface MinimumWindowCodeCase {
  id: string
  label: string
  input: MinimumWindowInput
  expected: string
  visibility: 'public' | 'hidden'
}

export const findMinimumWindow = ({ source, target }: MinimumWindowInput): string => {
  if (source.length === 0 || target.length === 0 || target.length > source.length) return ''
  const need = Array<number>(128).fill(0)
  for (const character of target) need[character.charCodeAt(0)] += 1

  let left = 0
  let missing = target.length
  let bestStart = 0
  let bestLength = source.length + 1

  for (let right = 0; right < source.length; right += 1) {
    const incoming = source.charCodeAt(right)
    if (need[incoming] > 0) missing -= 1
    need[incoming] -= 1
    while (missing === 0) {
      const currentLength = right - left + 1
      if (currentLength < bestLength) {
        bestStart = left
        bestLength = currentLength
      }
      const outgoing = source.charCodeAt(left)
      need[outgoing] += 1
      if (need[outgoing] > 0) missing += 1
      left += 1
    }
  }
  return bestLength > source.length ? '' : source.slice(bestStart, bestStart + bestLength)
}

export const MINIMUM_WINDOW_BATCHES: MinimumWindowVerificationBatch[] = [
  {
    id: 'mixed-signal', name: '混合信号带',
    source: 'ADOBECODEBANC', target: 'ABC', expected: 'BANC',
  },
  {
    id: 'repeated-debt', name: '重复欠账带',
    source: 'AAABBC', target: 'AABC', expected: 'AABBC',
  },
  {
    id: 'tail-window', name: '末端覆盖带',
    source: 'XYZABCA', target: 'ABC', expected: 'ABC',
  },
]

const HIDDEN_INPUTS: MinimumWindowInput[] = [
  { source: '', target: 'A' },
  { source: 'a', target: 'a' },
  { source: 'a', target: 'aa' },
  { source: 'aa', target: 'aa' },
  { source: 'bba', target: 'ab' },
  { source: 'ABAACBAB', target: 'AABC' },
  { source: 'aA', target: 'A' },
]

export const MINIMUM_WINDOW_CODE_CASES: MinimumWindowCodeCase[] = [
  ...MINIMUM_WINDOW_BATCHES.map((batch, index) => ({
    id: `public-${index + 1}`,
    label: `公开校准 ${index + 1}`,
    input: { source: batch.source, target: batch.target },
    expected: batch.expected,
    visibility: 'public' as const,
  })),
  ...HIDDEN_INPUTS.map((input, index) => ({
    id: `hidden-${index + 1}`,
    label: '隐藏文字带',
    input,
    expected: findMinimumWindow(input),
    visibility: 'hidden' as const,
  })),
]
