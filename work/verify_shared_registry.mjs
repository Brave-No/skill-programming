import { existsSync, readFileSync } from 'node:fs'

const registry = readFileSync('FRONTEND.md', 'utf8')
const requiredRegistryFacts = [
  '`ChallengeCompletion`',
  '`src/shared/completion/ChallengeCompletion.tsx`',
  '`ChallengeCompletionProps`',
  '`SkillProgramBuilder`',
  '`src/shared/program/SkillProgramBuilder.tsx`',
  '雨线峡谷 / 接雨水',
  '零号仓库 / 移动零 V2',
  '频谱滑窗站 / 找到字符串中所有字母异位词',
]
const requiredFiles = [
  'src/shared/completion/ChallengeCompletion.tsx',
  'src/shared/completion/challengeCompletion.css',
  'src/shared/completion/index.ts',
  'src/shared/completion/ChallengeCompletion.test.tsx',
  'src/shared/program/SkillProgramBuilder.tsx',
  'src/shared/program/SkillProgramBuilder.test.tsx',
  'src/shared/program/index.ts',
]
const consumerChecks = [
  { component: 'ChallengeCompletion', file: 'src/components/CodePractice.tsx' },
  { component: 'ChallengeCompletion', file: 'apps/zero-warehouse/src/v2/codePractice/CodePracticeV2.tsx' },
  { component: 'SkillProgramBuilder', file: 'src/components/ProgramBuilder.tsx' },
  { component: 'SkillProgramBuilder', file: 'src/challenges/find-all-anagrams/App.tsx' },
]
const publicExport = readFileSync('src/shared/completion/index.ts', 'utf8')
const programPublicExport = readFileSync('src/shared/program/index.ts', 'utf8')

for (const fact of requiredRegistryFacts) {
  if (!registry.includes(fact)) throw new Error(`FRONTEND.md 缺少正式共享登记：${fact}`)
}

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`正式共享源码或测试不存在：${file}`)
}

for (const exportedName of ['ChallengeCompletion', 'ChallengeCompletionProps']) {
  if (!publicExport.includes(exportedName)) {
    throw new Error(`共享入口缺少公开导出：${exportedName}`)
  }
}

for (const exportedName of ['SkillProgramBuilder', 'SkillProgramNode', 'SkillProgramBuilderLabels']) {
  if (!programPublicExport.includes(exportedName)) {
    throw new Error(`共享编排器入口缺少公开导出：${exportedName}`)
  }
}

if (existsSync('src/product/completion/ChallengeCompletion.tsx')) {
  throw new Error('产品预览目录仍存在 ChallengeCompletion 分叉源码')
}

for (const { component, file } of consumerChecks) {
  const source = readFileSync(file, 'utf8')
  if (!source.includes(component)) {
    throw new Error(`登记使用方未引用 ${component}：${file}`)
  }
}

console.log('SHARED_REGISTRY_VERIFY_PASS ChallengeCompletion 2 consumers; SkillProgramBuilder 2 consumers')
