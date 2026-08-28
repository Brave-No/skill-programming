import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_CATALOG,
  validateChallengeCatalog,
  type ChallengeCatalogEntryV2,
} from './challenges'

const availableFixture: ChallengeCatalogEntryV2 = {
  ...CHALLENGE_CATALOG[0],
  id: 'fixture',
  order: 99,
  route: '/games/fixture/',
}

describe('challenge catalog V2', () => {
  it('registers valid challenges with dedicated routes', () => {
    expect(validateChallengeCatalog(CHALLENGE_CATALOG)).toEqual([])
    expect(new Set(CHALLENGE_CATALOG.map(({ id }) => id)).size).toBe(CHALLENGE_CATALOG.length)
    expect(new Set(CHALLENGE_CATALOG.map(({ route }) => route)).size).toBe(CHALLENGE_CATALOG.length)
    expect(CHALLENGE_CATALOG).toContainEqual(expect.objectContaining({
      id: 'longest-substring-without-repeating-characters',
      route: '/games/character-corridor/',
      preview: expect.objectContaining({ src: '/previews/character-corridor.png' }),
    }))
  })

  it('keeps taxonomy, state and delivery metadata explicit', () => {
    for (const entry of CHALLENGE_CATALOG) {
      expect(entry.trackId).toBeTruthy()
      expect(entry.dataStructureIds.length).toBeGreaterThan(0)
      expect(entry.techniqueIds.length).toBeGreaterThan(0)
      expect(entry.languageIds).toEqual(['java'])
      expect(entry.stageCount).toBe(6)
      expect(entry.estimatedMinutes).toBeGreaterThan(0)
      expect(entry.status).toBe('available')
      expect(entry.route).toMatch(/^\/games\//)
      expect(entry.preview?.src).toMatch(/^\/previews\//)
    }
  })

  it('rejects invalid available, coming-soon and locked states', () => {
    const entries: ChallengeCatalogEntryV2[] = [
      { ...availableFixture, preview: null },
      { ...availableFixture, id: 'soon', order: 100, status: 'coming-soon' },
      {
        ...availableFixture,
        id: 'locked',
        order: 101,
        status: 'locked',
        route: null,
        preview: null,
        prerequisiteIds: [],
      },
    ]
    const issues = validateChallengeCatalog(entries)
    expect(issues.some((issue) => issue.includes('缺少真实预览'))).toBe(true)
    expect(issues.some((issue) => issue.includes('非开放关卡不能提供可玩路径'))).toBe(true)
    expect(issues.some((issue) => issue.includes('锁定关卡缺少前置条件'))).toBe(true)
  })

  it('accepts a truthful locked entry with an existing prerequisite', () => {
    const entries: ChallengeCatalogEntryV2[] = [
      availableFixture,
      {
        ...availableFixture,
        id: 'locked',
        order: 100,
        status: 'locked',
        route: null,
        preview: null,
        prerequisiteIds: ['fixture'],
      },
    ]
    expect(validateChallengeCatalog(entries)).toEqual([])
  })
})
