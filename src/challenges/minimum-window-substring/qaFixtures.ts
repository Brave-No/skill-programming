import { createMinimumWindowSkillNode, type MinimumWindowSkillNode } from './model'

export const createCorrectMinimumWindowProgram = (
  prefix = 'qa-minimum-window',
): MinimumWindowSkillNode[] => {
  const shrink = createMinimumWindowSkillNode('shrink-covered-window', `${prefix}-shrink`)
  shrink.children = [
    createMinimumWindowSkillNode('save-best-window', `${prefix}-save-best`),
    createMinimumWindowSkillNode('read-outgoing-character', `${prefix}-read-outgoing`),
  ]

  const scan = createMinimumWindowSkillNode('scan-source', `${prefix}-scan`)
  scan.children = [
    createMinimumWindowSkillNode('read-incoming-character', `${prefix}-read-incoming`),
    shrink,
  ]

  return [
    createMinimumWindowSkillNode('initialize-window', `${prefix}-initialize`),
    scan,
  ]
}

export const createWrongDebtOrderProgram = (
  prefix = 'qa-wrong-debt-order',
): MinimumWindowSkillNode[] => {
  const program = createCorrectMinimumWindowProgram(prefix)
  const scan = program[1]
  scan.children = [scan.children[1], scan.children[0]]
  return program
}

export const createNoShrinkProgram = (
  prefix = 'qa-no-shrink',
): MinimumWindowSkillNode[] => {
  const program = createCorrectMinimumWindowProgram(prefix)
  program[1].children = program[1].children.filter((node) => node.type !== 'shrink-covered-window')
  return program
}

export const EQUIVALENT_MINIMUM_WINDOW_JAVA = `int[] debt = new int[128];
int goal = 0;
while (t.length() > goal) {
  int wanted = t.charAt(goal);
  debt[wanted] += 1;
  goal += 1;
}
int lo = 0;
int hi = 0;
int open = t.length();
int answerAt = 0;
int answerSize = 1 + s.length();
while (s.length() > hi) {
  int enter = s.charAt(hi);
  if (0 < debt[enter]) {
    open -= 1;
  }
  debt[enter] -= 1;
  while (0 == open) {
    int size = hi - lo + 1;
    if (answerSize > size) {
      answerAt = lo;
      answerSize = size;
    }
    int leave = s.charAt(lo);
    debt[leave] += 1;
    if (0 < debt[leave]) {
      open += 1;
    }
    lo += 1;
  }
  hi += 1;
}
if (s.length() < answerSize) {
  return s.substring(0, 0);
}
return s.substring(answerAt, answerSize + answerAt);`

export const WRONG_DISTINCT_ONLY_JAVA = `int[] need = new int[128];
int targetIndex = 0;
while (targetIndex < t.length()) {
  int targetChar = t.charAt(targetIndex);
  need[targetChar] = 1;
  targetIndex++;
}
int left = 0;
int right = 0;
int missing = t.length();
int bestStart = 0;
int bestLength = s.length() + 1;
while (right < s.length()) {
  int incoming = s.charAt(right);
  if (need[incoming] > 0) { missing--; }
  need[incoming]--;
  while (missing == 0) {
    int currentLength = right - left + 1;
    if (currentLength < bestLength) {
      bestStart = left;
      bestLength = currentLength;
    }
    int outgoing = s.charAt(left);
    need[outgoing]++;
    if (need[outgoing] > 0) { missing++; }
    left++;
  }
  right++;
}
if (bestLength > s.length()) { return s.substring(0, 0); }
return s.substring(bestStart, bestStart + bestLength);`
