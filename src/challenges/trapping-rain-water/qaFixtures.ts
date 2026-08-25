import { createSkillNode, type SkillNode } from '../../game/model'

export const createCorrectRainWaterProgram = (prefix = 'qa-correct'): SkillNode[] => {
  const patrol = createSkillNode('patrol', `${prefix}-patrol`)
  patrol.children = [
    createSkillNode('compare', `${prefix}-compare`),
    createSkillNode('advance', `${prefix}-advance`),
    createSkillNode('update-max', `${prefix}-update-max`),
    createSkillNode('collect', `${prefix}-collect`),
  ]
  return [createSkillNode('deploy', `${prefix}-deploy`), patrol]
}

export const createStalledRainWaterProgram = (prefix = 'qa-stalled'): SkillNode[] => {
  const patrol = createSkillNode('patrol', `${prefix}-patrol`)
  patrol.children = [
    createSkillNode('compare', `${prefix}-compare`),
    createSkillNode('collect', `${prefix}-collect`),
  ]
  return [createSkillNode('deploy', `${prefix}-deploy`), patrol]
}
