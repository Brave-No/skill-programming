export type BlockType =
  | 'set-write'
  | 'for-each'
  | 'if-occupied'
  | 'swap'
  | 'advance-write'

export type FrameStatus = 'idle' | 'running' | 'success' | 'error'

export interface BlockNode {
  id: string
  type: BlockType
  children: BlockNode[]
}

export interface TraceFrame {
  id: number
  values: number[]
  scanIndex: number | null
  writeIndex: number | null
  activeBlockId: string | null
  changedIndices: number[]
  status: FrameStatus
  message: string
}

export interface InterpretationResult {
  frames: TraceFrame[]
  success: boolean
  finalValues: number[]
  error?: string
}

export interface BlockDefinition {
  type: BlockType
  id: string
  label: string
  shortLabel: string
  tone: 'yellow' | 'teal' | 'coral' | 'ink' | 'steel'
  acceptsChildren: boolean
}

export interface Batch {
  input: number[]
  expected: number[]
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    id: 'block-set-write',
    type: 'set-write',
    label: '装载标记放到 0 号位',
    shortLabel: '设置装载位',
    tone: 'yellow',
    acceptsChildren: false,
  },
  {
    id: 'block-for-each',
    type: 'for-each',
    label: '扫描每个货位',
    shortLabel: '逐个扫描',
    tone: 'ink',
    acceptsChildren: true,
  },
  {
    id: 'block-if-occupied',
    type: 'if-occupied',
    label: '如果扫描位有货',
    shortLabel: '检查有货',
    tone: 'teal',
    acceptsChildren: true,
  },
  {
    id: 'block-swap',
    type: 'swap',
    label: '交换扫描位与装载位',
    shortLabel: '交换货位',
    tone: 'coral',
    acceptsChildren: false,
  },
  {
    id: 'block-advance-write',
    type: 'advance-write',
    label: '装载标记前进一步',
    shortLabel: '装载位前进',
    tone: 'steel',
    acceptsChildren: false,
  },
]

export const BATCHES: Batch[] = [
  { input: [0, 4, 0, 2, 9], expected: [4, 2, 9, 0, 0] },
  { input: [5, 0, 1, 0, 8], expected: [5, 1, 8, 0, 0] },
  { input: [0, 0, 6, 3, 0], expected: [6, 3, 0, 0, 0] },
]

export const createBlock = (type: BlockType): BlockNode => {
  const definition = BLOCK_DEFINITIONS.find((item) => item.type === type)
  if (!definition) throw new Error(`Unknown block type: ${type}`)
  return { id: definition.id, type, children: [] }
}

export const getDefinition = (type: BlockType) =>
  BLOCK_DEFINITIONS.find((item) => item.type === type)!

export const collectNodeIds = (nodes: BlockNode[]): string[] =>
  nodes.flatMap((node) => [node.id, ...collectNodeIds(node.children)])

export const createCorrectProgram = (): BlockNode[] => {
  const condition = createBlock('if-occupied')
  condition.children = [createBlock('swap'), createBlock('advance-write')]
  const loop = createBlock('for-each')
  loop.children = [condition]
  return [createBlock('set-write'), loop]
}
