import { createAnagramSkillNode, type AnagramSkillNode } from './model'

export const createCorrectAnagramProgram = (prefix = 'qa-anagram'): AnagramSkillNode[] => {
  const overflow = createAnagramSkillNode('if-overflow', `${prefix}-if-overflow`)
  const match = createAnagramSkillNode('if-match', `${prefix}-if-match`)

  const sourceLoop = createAnagramSkillNode('scan-source', `${prefix}-scan-source`)
  sourceLoop.children = [
    createAnagramSkillNode('add-incoming', `${prefix}-add-incoming`),
    overflow,
    match,
  ]

  return [
    createAnagramSkillNode('prepare', `${prefix}-prepare`),
    sourceLoop,
  ]
}

export const createMissingRemovalProgram = (prefix = 'qa-missing-removal') => {
  const program = createCorrectAnagramProgram(prefix)
  program[1].children = program[1].children.filter((node) => node.type !== 'if-overflow')
  return program
}
