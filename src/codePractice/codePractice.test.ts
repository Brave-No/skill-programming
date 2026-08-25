import { describe, expect, it } from 'vitest'
import { RAIN_WATER_CHALLENGE } from '../challenges/trapping-rain-water/challenge'
import { composeRainWaterReferenceBody } from '../challenges/trapping-rain-water/reference'
import { parseJavaSubset, runJavaSubset } from './javaSubset'
import {
  composeStructuredBody,
  validateStructuredDraft,
  type StructuredDraft,
} from './structuredMode'

const customBody = `int l = 0;
int r = height.length - 1;
int highL = height.length == 0 ? 0 : height[l];
int highR = height.length == 0 ? 0 : height[r];
int result = 0;
while (l < r) {
  if (highL <= highR) {
    l++;
    highL = Math.max(height[l], highL);
    result += highL - height[l];
  } else {
    r--;
    highR = Math.max(height[r], highR);
    result += highR - height[r];
  }
}
return result;`

const wrongOrderBody = customBody.replace(
  `l++;
    highL = Math.max(height[l], highL);`,
  `highL = Math.max(height[l], highL);
    l++;`,
)

const structuredDraft: StructuredDraft = {
  preparation: `int left = 0;
int right = height.length - 1;
int leftMax = height.length == 0 ? 0 : height[left];
int rightMax = height.length == 0 ? 0 : height[right];
int water = 0;`,
  'loop-condition': 'left < right',
  'shore-condition': 'leftMax <= rightMax',
  'left-advance': 'left++',
  'left-update-max': 'leftMax = Math.max(leftMax, height[left])',
  'left-collect': 'water += leftMax - height[left]',
  'right-advance': 'right--',
  'right-update-max': 'rightMax = Math.max(rightMax, height[right])',
  'right-collect': 'water += rightMax - height[right]',
  result: 'water',
}

describe('rain water Java practice', () => {
  it('runs the canonical reference against public and hidden cases', () => {
    const source = composeRainWaterReferenceBody()
    const semantic = RAIN_WATER_CHALLENGE.validate(parseJavaSubset(source))

    expect(semantic.valid).toBe(true)
    for (const testCase of RAIN_WATER_CHALLENGE.codePractice.cases) {
      expect(runJavaSubset(source, testCase.input, testCase.expected)).toMatchObject({ ok: true })
    }
  })

  it('accepts equivalent variable names and swapped Math.max arguments', () => {
    const semantic = RAIN_WATER_CHALLENGE.validate(parseJavaSubset(customBody))

    expect(semantic.valid).toBe(true)
    expect(runJavaSubset(customBody, [4, 2, 0, 6, 2, 5], 9)).toMatchObject({ ok: true })
  })

  it('rejects updating a maximum before the scout advances', () => {
    const semantic = RAIN_WATER_CHALLENGE.validate(parseJavaSubset(wrongOrderBody))

    expect(semantic.valid).toBe(false)
    expect(semantic.issue?.check).toBe('leftUpdateMax')
    expect(semantic.issue?.message).toContain('移动后')
  })

  it('requires the subtraction after the maximum update', () => {
    const withoutLeftCollection = customBody.replace(
      '    result += highL - height[l];\n',
      '',
    )
    const semantic = RAIN_WATER_CHALLENGE.validate(parseJavaSubset(withoutLeftCollection))

    expect(semantic.valid).toBe(false)
    expect(semantic.issue?.check).toBe('leftCollect')
    expect(semantic.issue?.message).toContain('减去当前柱高')
  })

  it('keeps every result-related concept linked across the learning stages', () => {
    const challenge = RAIN_WATER_CHALLENGE
    const skillIds = new Set<string>(challenge.skills.map((skill) => skill.type))
    const stepIds = new Set(challenge.codePractice.referenceSteps.map((step) => step.id))
    const mappingIds = new Set(challenge.codePractice.mappings.map((entry) => entry.id))
    const slotIds = new Set(challenge.codePractice.scaffold.slots.map((slot) => slot.id))
    const semanticChecks = new Set(Object.keys(challenge.validate(parseJavaSubset(customBody)).checks))

    for (const concept of challenge.concepts) {
      expect(concept.links.sceneIds.length, concept.id).toBeGreaterThan(0)
      concept.links.skillIds.forEach((id) => expect(skillIds.has(id), `${concept.id}:skill:${id}`).toBe(true))
      concept.links.referenceStepIds.forEach((id) => expect(stepIds.has(id), `${concept.id}:step:${id}`).toBe(true))
      concept.links.mappingEntryIds.forEach((id) => expect(mappingIds.has(id), `${concept.id}:mapping:${id}`).toBe(true))
      concept.links.structuredSlotIds.forEach((id) => expect(slotIds.has(id), `${concept.id}:slot:${id}`).toBe(true))
      concept.links.semanticChecks.forEach((id) => expect(semanticChecks.has(id), `${concept.id}:check:${id}`).toBe(true))
    }
  })

  it('keeps unsupported syntax explicit and stops infinite patrols', () => {
    expect(runJavaSubset('for (;;) { } return 0;', [], 0)).toMatchObject({
      ok: false,
      kind: 'unsupported',
    })
    expect(runJavaSubset('while (true) { } return 0;', [], 0)).toMatchObject({
      ok: false,
      kind: 'timeout',
    })
  })

  it('composes and validates the locked structured scaffold', () => {
    const composition = composeStructuredBody(
      RAIN_WATER_CHALLENGE.codePractice.scaffold,
      structuredDraft,
    )
    const validation = validateStructuredDraft(
      RAIN_WATER_CHALLENGE,
      structuredDraft,
      composition,
    )

    expect(composition.source).toContain('while (left < right) {')
    expect(composition.source).toContain('left++;')
    expect(validation.kind).toBe('valid')
  })

  it('maps the first missing structured responsibility to its input', () => {
    const validation = validateStructuredDraft(
      RAIN_WATER_CHALLENGE,
      { ...structuredDraft, 'right-advance': '' },
    )

    expect(validation).toMatchObject({
      kind: 'invalid',
      issue: { kind: 'required', slotId: 'right-advance' },
    })
  })
})
