import { createWindowSkillNode, type WindowSkillNode } from './model'

export const createCorrectWindowProgram = (prefix = 'qa-correct'): WindowSkillNode[] => {
  const scan = createWindowSkillNode('scan', `${prefix}-scan`)
  const shrink = createWindowSkillNode('shrink-duplicates', `${prefix}-shrink`)
  scan.children = [
    shrink,
    createWindowSkillNode('admit-current', `${prefix}-admit`),
    createWindowSkillNode('update-best', `${prefix}-best`),
  ]
  return [createWindowSkillNode('initialize', `${prefix}-initialize`), scan]
}

export const createSingleShrinkWindowProgram = (prefix = 'qa-single-shrink'): WindowSkillNode[] => {
  const scan = createWindowSkillNode('scan', `${prefix}-scan`)
  scan.children = [
    createWindowSkillNode('admit-current', `${prefix}-admit`),
    createWindowSkillNode('update-best', `${prefix}-best`),
  ]
  return [createWindowSkillNode('initialize', `${prefix}-initialize`), scan]
}
