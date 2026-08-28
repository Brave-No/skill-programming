import { describe, expect, it } from 'vitest'
import { parseJavaSubset, runJavaSubset } from '../../codePractice/javaSubset'
import { ANAGRAM_CHALLENGE } from './challenge'
import { ANAGRAM_CODE_CASES } from './cases'
import { composeAnagramReferenceBody } from './reference'
import { analyzeAnagramProgram } from './semantics'

const renamedBody = `int[] needed = new int[26];
int[] seen = new int[26];
int start = 0;
List<Integer> hits = new ArrayList<>();
for (int patternCursor = 0; patternCursor < p.length(); patternCursor += 1) {
  needed[p.charAt(patternCursor) - 97] += 1;
}
for (int probe = 0; probe < s.length(); probe += 1) {
  seen[s.charAt(probe) - 97] += 1;
  if (probe - start + 1 > p.length()) {
    seen[s.charAt(start) - 97] -= 1;
    start += 1;
  }
  if (Arrays.equals(seen, needed)) {
    hits.add(start);
  }
}
return hits;`

describe('find-all-anagrams Java practice', () => {
  it('parses, semantically validates and executes the canonical reference', () => {
    const source = composeAnagramReferenceBody()
    const program = parseJavaSubset(source)
    expect(analyzeAnagramProgram(program).valid).toBe(true)
    for (const testCase of ANAGRAM_CODE_CASES) {
      expect(
        ANAGRAM_CHALLENGE.codePractice.runtime.run(source, testCase.input, testCase.expected),
        testCase.id,
      ).toMatchObject({ ok: true, value: testCase.expected })
    }
  })

  it('accepts renamed roles, numeric alphabet offsets and reversed equality arguments', () => {
    const semantic = analyzeAnagramProgram(parseJavaSubset(renamedBody))
    expect(semantic.valid, semantic.issue?.message).toBe(true)
    expect(runJavaSubset<number[]>(
      renamedBody,
      { s: 'abab', p: 'ab' },
      [0, 1, 2],
    )).toMatchObject({ ok: true, value: [0, 1, 2] })
  })

  it('rejects removing the boundary without updating the outgoing frequency', () => {
    const wrong = composeAnagramReferenceBody().replace(
      "window[s.charAt(left) - 'a']--;",
      '',
    )
    const semantic = analyzeAnagramProgram(parseJavaSubset(wrong))
    expect(semantic.valid).toBe(false)
    expect(semantic.issue?.check).toBe('removeOutgoing')
  })

  it('rejects recording the right probe instead of the window start', () => {
    const wrong = composeAnagramReferenceBody().replace('result.add(left);', 'result.add(right);')
    const semantic = analyzeAnagramProgram(parseJavaSubset(wrong))
    expect(semantic.valid).toBe(false)
    expect(semantic.issue?.check).toBe('recordIndex')
  })

  it('keeps unsupported collection operations explicit', () => {
    const wrong = composeAnagramReferenceBody().replace('result.add(left);', 'result.clear();')
    expect(runJavaSubset<number[]>(wrong, { s: 'abc', p: 'abc' }, [0])).toMatchObject({
      ok: false,
      kind: 'unsupported',
    })
  })
})
