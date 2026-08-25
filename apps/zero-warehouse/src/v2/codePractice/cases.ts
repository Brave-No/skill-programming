import { BATCHES } from '../../game/model'

export interface CodePracticeCase {
  id: string
  label: string
  input: number[]
  expected: number[]
  visibility: '公开' | '隐藏'
}

const compact = (values: number[]) => {
  const cargo = values.filter((value) => value !== 0)
  return [...cargo, ...Array(values.length - cargo.length).fill(0)]
}

export const CODE_PRACTICE_CASES: CodePracticeCase[] = [
  ...BATCHES.map((batch, index) => ({
    id: `public-${index + 1}`,
    label: `公开批次 ${index + 1}`,
    input: batch.input,
    expected: batch.expected,
    visibility: '公开' as const,
  })),
  { id: 'edge-empty', label: '隐藏用例', input: [], expected: [], visibility: '隐藏' },
  { id: 'edge-all-zero', label: '隐藏用例', input: [0, 0, 0, 0], expected: [0, 0, 0, 0], visibility: '隐藏' },
  { id: 'edge-no-zero', label: '隐藏用例', input: [3, 7, 1], expected: [3, 7, 1], visibility: '隐藏' },
  { id: 'edge-single', label: '隐藏用例', input: [0], expected: [0], visibility: '隐藏' },
  {
    id: 'edge-mixed',
    label: '隐藏用例',
    input: [7, 0, 0, 4, 0, 9],
    expected: compact([7, 0, 0, 4, 0, 9]),
    visibility: '隐藏',
  },
]

export const PUBLIC_CODE_PRACTICE_CASES = CODE_PRACTICE_CASES.filter(
  (testCase) => testCase.visibility === '公开',
)
