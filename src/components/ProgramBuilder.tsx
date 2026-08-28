import {
  Anchor,
  BetweenHorizontalStart,
  Droplets,
  Mountain,
  Repeat2,
  ScanLine,
} from 'lucide-react'
import {
  createSkillNode,
  type SkillNode,
  type SkillDefinition,
  type SkillType,
} from '../game/model'
import { SkillProgramBuilder } from '../shared/program'

interface ProgramBuilderProps {
  program: SkillNode[]
  activeNodeId: string | null
  disabled: boolean
  skills: SkillDefinition[]
  onChange: (program: SkillNode[]) => void
  onClear: () => void
  onPreviewSkill?: (type: SkillType) => void
}

const skillIcon = (type: SkillType, size: number) => {
  switch (type) {
    case 'deploy': return <Anchor size={size} />
    case 'patrol': return <Repeat2 size={size} />
    case 'compare': return <ScanLine size={size} />
    case 'collect': return <Droplets size={size} />
    case 'advance': return <BetweenHorizontalStart size={size} />
    case 'update-max': return <Mountain size={size} />
  }
}

export default function ProgramBuilder(props: ProgramBuilderProps) {
  return (
    <SkillProgramBuilder
      {...props}
      createNode={createSkillNode}
      renderSkillIcon={skillIcon}
      labels={{
        ariaLabel: '双指针技能编排器',
        shelfKicker: '技能架',
        shelfTitle: '巡检技能',
        programKicker: '执行顺序',
        programTitle: '巡检程序',
        rootScope: '主流程',
        nestedScope: '每一轮',
        clearProgram: '清空巡检程序',
        emptyProgram: '从技能架选择第一项',
      }}
    />
  )
}
