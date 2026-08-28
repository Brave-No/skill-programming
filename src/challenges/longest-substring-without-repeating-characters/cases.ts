import { findLongestUniqueWindow } from './interpreter'

export interface WindowVerificationBatch {
  id: string
  name: string
  source: string
  expectedLength: number
}

export interface WindowCodeCase {
  id: string
  label: string
  input: string
  expected: number
  visibility: 'public' | 'hidden'
}

export const WINDOW_BATCHES: WindowVerificationBatch[] = [
  { id: 'returning-pattern', name: '往返字符带', source: 'abcabcbb', expectedLength: 3 },
  { id: 'single-signal', name: '单一信号带', source: 'bbbbb', expectedLength: 1 },
  { id: 'crossed-repeat', name: '交错重复带', source: 'pwwkew', expectedLength: 3 },
]
const HIDDEN_SOURCES = [
  '',
  'x',
  'dvdf',
  'abba',
  'tmmzuxt',
  'a b!a',
]

export const WINDOW_CODE_CASES: WindowCodeCase[] = [
  ...WINDOW_BATCHES.map((batch, index) => ({
    id: `public-${index + 1}`,
    label: `公开字符带 ${index + 1}`,
    input: batch.source,
    expected: batch.expectedLength,
    visibility: 'public' as const,
  })),
  ...HIDDEN_SOURCES.map((source, index) => ({
    id: `hidden-${index + 1}`,
    label: '隐藏字符带',
    input: source,
    expected: findLongestUniqueWindow(source).length,
    visibility: 'hidden' as const,
  })),
]
