import { createArchiveSkillNode, type ArchiveSkillNode } from './model'

export const createCorrectArchiveProgram = (prefix = 'archive-qa'): ArchiveSkillNode[] => {
  const initialize = createArchiveSkillNode('initialize-archive', `${prefix}-initialize`)
  const scan = createArchiveSkillNode('scan-values', `${prefix}-scan`)
  scan.children = [
    createArchiveSkillNode('accumulate-prefix', `${prefix}-accumulate`),
    createArchiveSkillNode('count-matches', `${prefix}-count`),
    createArchiveSkillNode('record-prefix', `${prefix}-record`),
  ]
  return [initialize, scan]
}

export const createRecordBeforeCountProgram = (prefix = 'archive-wrong'): ArchiveSkillNode[] => {
  const program = createCorrectArchiveProgram(prefix)
  program[1].children = [
    program[1].children[0],
    program[1].children[2],
    program[1].children[1],
  ]
  return program
}

export const ARCHIVE_REFERENCE_BODY = `Map<Integer, Integer> frequency = new HashMap<>();
frequency.put(0, 1);
int index = 0;
int prefixSum = 0;
int needed = 0;
int count = 0;
while (index < nums.length) {
  prefixSum += nums[index];
  needed = prefixSum - k;
  count += frequency.getOrDefault(needed, 0);
  frequency.put(prefixSum, frequency.getOrDefault(prefixSum, 0) + 1);
  index++;
}
return count;`

export const ARCHIVE_RENAMED_BODY = `Map<Integer, Integer> ledger = new HashMap<>();
ledger.put(0, 1);
int cursor = 0;
int running = 0;
int answer = 0;
while (cursor < nums.length) {
  running = nums[cursor] + running;
  answer = ledger.getOrDefault(running - k, 0) + answer;
  ledger.put(running, 1 + ledger.getOrDefault(running, 0));
  cursor += 1;
}
return answer;`

export const ARCHIVE_RECORD_BEFORE_COUNT_BODY = `Map<Integer, Integer> frequency = new HashMap<>();
frequency.put(0, 1);
int index = 0;
int prefixSum = 0;
int needed = 0;
int count = 0;
while (index < nums.length) {
  prefixSum += nums[index];
  needed = prefixSum - k;
  frequency.put(prefixSum, frequency.getOrDefault(prefixSum, 0) + 1);
  count += frequency.getOrDefault(needed, 0);
  index++;
}
return count;`

export const ARCHIVE_MISSING_SEED_BODY = `Map<Integer, Integer> frequency = new HashMap<>();
int index = 0;
int prefixSum = 0;
int count = 0;
while (index < nums.length) {
  prefixSum += nums[index];
  count += frequency.getOrDefault(prefixSum - k, 0);
  frequency.put(prefixSum, frequency.getOrDefault(prefixSum, 0) + 1);
  index++;
}
return count;`
