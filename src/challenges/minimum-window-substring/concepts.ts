import type { AlgorithmConceptDefinition } from '../types'

export const MINIMUM_WINDOW_CONCEPTS: AlgorithmConceptDefinition[] = [
  {
    id: 'source-text', kind: 'input', label: '源字符串',
    worldMeaning: '校准台下方被连续扫描的文字带。', canonicalCode: 'String s',
    lifecycle: { initialization: '方法入参', reads: ['读取入窗字符', '读取出窗字符', '截取结果'], writes: [], updateRule: '只读，不修改输入字符串' },
    links: { sceneIds: ['source-track'], skillIds: ['scan-source', 'read-incoming-character', 'read-outgoing-character'], traceFields: ['source'], referenceStepIds: ['source-loop-open', 'read-incoming', 'read-outgoing', 'empty-result', 'return-window'], mappingEntryIds: ['source'], structuredSlotIds: ['window-preparation', 'scan-condition', 'read-incoming', 'read-outgoing', 'no-answer-condition', 'empty-result', 'window-result'], semanticChecks: ['prepareWindow', 'sourceLoop', 'readIncoming', 'readOutgoing', 'emptyResult', 'returnWindow'] },
  },
  {
    id: 'target-text', kind: 'input', label: '目标字符串',
    worldMeaning: '需求卡上必须被窗口完整覆盖的字符及次数。', canonicalCode: 'String t',
    lifecycle: { initialization: '方法入参', reads: ['登记字符欠账', '初始化总欠账'], writes: [], updateRule: '只读，不修改目标字符串' },
    links: { sceneIds: ['target-card'], skillIds: ['initialize-window'], traceFields: ['target'], referenceStepIds: ['target-loop-open', 'read-target', 'prepare-window'], mappingEntryIds: ['target'], structuredSlotIds: ['target-condition', 'read-target', 'window-preparation'], semanticChecks: ['targetLoop', 'readTarget', 'prepareWindow'] },
  },
  {
    id: 'need-table', kind: 'state', label: '字符欠账表',
    worldMeaning: '每格余额说明窗口还欠、刚好满足或额外拥有多少个该字符。', canonicalCode: 'int[] need',
    lifecycle: { initialization: 'new int[128]', reads: ['入窗欠账判断', '出窗恢复判断'], writes: ['目标登记 +1', '入窗 -1', '出窗 +1'], updateRule: '正数为欠账，零为刚好，负数为余量' },
    links: { sceneIds: ['need-ledger'], skillIds: ['initialize-window', 'read-incoming-character', 'read-outgoing-character'], traceFields: ['needEntries', 'changedCode'], referenceStepIds: ['initialize', 'add-target-debt', 'incoming-check-open', 'debit-incoming', 'credit-outgoing', 'restore-check-open'], mappingEntryIds: ['need', 'need-debit', 'need-credit'], structuredSlotIds: ['target-preparation', 'add-target-debt', 'incoming-debt-condition', 'debit-incoming', 'credit-outgoing', 'restored-condition'], semanticChecks: ['initialize', 'addTargetDebt', 'incomingCheck', 'debitIncoming', 'creditOutgoing', 'restoreCheck'] },
  },
  {
    id: 'missing-count', kind: 'state', label: '总欠账',
    worldMeaning: '窗口距离完整覆盖目标还缺少的字符总数。', canonicalCode: 'int missing',
    lifecycle: { initialization: 't.length()', reads: ['判断是否覆盖目标'], writes: ['必要字符入窗 -1', '必要字符出窗 +1'], updateRule: 'missing == 0 表示当前窗口完整覆盖目标' },
    links: { sceneIds: ['missing-meter', 'coverage-lamp'], skillIds: ['initialize-window', 'read-incoming-character', 'shrink-covered-window', 'read-outgoing-character'], traceFields: ['missing'], referenceStepIds: ['prepare-window', 'reduce-missing', 'shrink-loop-open', 'increase-missing'], mappingEntryIds: ['missing', 'need-debit', 'need-credit', 'shrink'], structuredSlotIds: ['window-preparation', 'reduce-missing', 'shrink-condition', 'increase-missing'], semanticChecks: ['prepareWindow', 'reduceMissing', 'shrinkLoop', 'increaseMissing'] },
  },
  {
    id: 'target-index', kind: 'state', label: '目标索引',
    worldMeaning: '需求卡上当前正在登记的字符位置。', canonicalCode: 'int targetIndex',
    lifecycle: { initialization: '0', reads: ['目标登记边界', '读取目标字符'], writes: ['每轮登记后 +1'], updateRule: '从 0 单调前进到 t.length()' },
    links: { sceneIds: ['target-cursor'], skillIds: ['initialize-window'], traceFields: ['targetIndex'], referenceStepIds: ['initialize', 'target-loop-open', 'read-target', 'advance-target'], mappingEntryIds: ['target-registration'], structuredSlotIds: ['target-preparation', 'target-condition', 'read-target', 'advance-target'], semanticChecks: ['initialize', 'targetLoop', 'readTarget', 'advanceTarget'] },
  },
  {
    id: 'left-boundary', kind: 'state', label: '左边界',
    worldMeaning: '当前连续窗口的起点标尺。', canonicalCode: 'int left',
    lifecycle: { initialization: '0', reads: ['窗口长度', '读取出窗字符', '保存最佳起点'], writes: ['每轮成功出窗后 +1'], updateRule: '只在覆盖收缩循环中单调右移' },
    links: { sceneIds: ['left-ruler'], skillIds: ['initialize-window', 'shrink-covered-window', 'save-best-window', 'read-outgoing-character'], traceFields: ['left'], referenceStepIds: ['prepare-window', 'measure-window', 'save-best', 'read-outgoing', 'advance-left'], mappingEntryIds: ['left', 'record-best'], structuredSlotIds: ['window-preparation', 'measure-window', 'save-best', 'read-outgoing', 'advance-left'], semanticChecks: ['prepareWindow', 'measureWindow', 'saveBest', 'readOutgoing', 'advanceLeft'] },
  },
  {
    id: 'right-boundary', kind: 'state', label: '右边界',
    worldMeaning: '当前扩张轮次读取的源字符位置。', canonicalCode: 'int right',
    lifecycle: { initialization: '0', reads: ['源串扫描边界', '读取入窗字符', '窗口长度'], writes: ['每个外层轮次末尾 +1'], updateRule: '从 0 单调前进到 s.length()' },
    links: { sceneIds: ['right-ruler'], skillIds: ['initialize-window', 'scan-source', 'read-incoming-character', 'save-best-window'], traceFields: ['right'], referenceStepIds: ['prepare-window', 'source-loop-open', 'read-incoming', 'measure-window', 'advance-right'], mappingEntryIds: ['right', 'record-best'], structuredSlotIds: ['window-preparation', 'scan-condition', 'read-incoming', 'measure-window', 'advance-right'], semanticChecks: ['prepareWindow', 'sourceLoop', 'readIncoming', 'measureWindow', 'advanceRight'] },
  },
  {
    id: 'best-window', kind: 'state', label: '历史最短窗口',
    worldMeaning: '扫描带下方封存的最短有效连续片段。', canonicalCode: 'bestStart / bestLength',
    lifecycle: { initialization: '0 / s.length() + 1', reads: ['比较是否更短', '无答案判断', '截取结果'], writes: ['当前覆盖窗口严格更短时同步更新'], updateRule: '长度只会减小，起点与长度必须同时写入' },
    links: { sceneIds: ['best-seal'], skillIds: ['initialize-window', 'save-best-window'], traceFields: ['bestStart', 'bestLength'], referenceStepIds: ['prepare-window', 'shorter-check-open', 'save-best', 'empty-result', 'return-window'], mappingEntryIds: ['best', 'record-best', 'result'], structuredSlotIds: ['window-preparation', 'shorter-condition', 'save-best', 'no-answer-condition', 'window-result'], semanticChecks: ['prepareWindow', 'shorterCheck', 'saveBest', 'emptyResult', 'returnWindow'] },
  },
  {
    id: 'target-character', kind: 'operation', label: '读取目标字符',
    worldMeaning: '需求卡当前准备登记进欠账台的字符。', canonicalCode: 't.charAt(targetIndex)',
    links: { sceneIds: ['target-cursor'], skillIds: ['initialize-window'], traceFields: ['incomingCode', 'changedCode'], referenceStepIds: ['read-target', 'add-target-debt'], mappingEntryIds: ['target-registration', 'char-at'], structuredSlotIds: ['read-target', 'add-target-debt'], semanticChecks: ['readTarget', 'addTargetDebt'] },
  },
  {
    id: 'incoming-character', kind: 'operation', label: '读取入窗字符',
    worldMeaning: '右标尺当前准备纳入窗口的字符。', canonicalCode: 's.charAt(right)',
    links: { sceneIds: ['incoming-cell'], skillIds: ['read-incoming-character'], traceFields: ['incomingCode', 'changedCode'], referenceStepIds: ['read-incoming', 'incoming-check-open', 'debit-incoming'], mappingEntryIds: ['incoming', 'need-debit', 'char-at'], structuredSlotIds: ['read-incoming', 'incoming-debt-condition', 'debit-incoming'], semanticChecks: ['readIncoming', 'incomingCheck', 'debitIncoming'] },
  },
  {
    id: 'outgoing-character', kind: 'operation', label: '读取出窗字符',
    worldMeaning: '左标尺当前准备移出窗口的字符。', canonicalCode: 's.charAt(left)',
    links: { sceneIds: ['outgoing-cell'], skillIds: ['read-outgoing-character'], traceFields: ['outgoingCode', 'changedCode'], referenceStepIds: ['read-outgoing', 'credit-outgoing', 'restore-check-open'], mappingEntryIds: ['outgoing', 'need-credit', 'char-at'], structuredSlotIds: ['read-outgoing', 'credit-outgoing', 'restored-condition'], semanticChecks: ['readOutgoing', 'creditOutgoing', 'restoreCheck'] },
  },
  {
    id: 'target-registration', kind: 'control', label: '目标登记循环',
    worldMeaning: '逐字把需求卡完整转为字符欠账。', canonicalCode: 'while (targetIndex < t.length())',
    links: { sceneIds: ['target-card'], skillIds: ['initialize-window'], traceFields: ['targetIndex', 'needEntries'], referenceStepIds: ['target-loop-open', 'add-target-debt', 'target-loop-close'], mappingEntryIds: ['target-registration'], structuredSlotIds: ['target-condition', 'add-target-debt'], semanticChecks: ['targetLoop', 'addTargetDebt', 'scopes'] },
  },
  {
    id: 'source-scan', kind: 'control', label: '源串扫描循环',
    worldMeaning: '右标尺逐字扩张窗口直到文字带末尾。', canonicalCode: 'while (right < s.length())',
    links: { sceneIds: ['source-track'], skillIds: ['scan-source'], traceFields: ['right'], referenceStepIds: ['source-loop-open', 'advance-right', 'source-loop-close'], mappingEntryIds: ['right'], structuredSlotIds: ['scan-condition', 'advance-right'], semanticChecks: ['sourceLoop', 'advanceRight', 'scopes'] },
  },
  {
    id: 'incoming-needed', kind: 'control', label: '入窗欠账判断',
    worldMeaning: '字符余额为正时，本次入窗会补齐一个真实欠缺。', canonicalCode: 'need[incoming] > 0',
    links: { sceneIds: ['need-ledger', 'missing-meter'], skillIds: ['read-incoming-character'], traceFields: ['needEntries', 'missing'], referenceStepIds: ['incoming-check-open', 'reduce-missing', 'incoming-check-close'], mappingEntryIds: ['need-debit'], structuredSlotIds: ['incoming-debt-condition', 'reduce-missing'], semanticChecks: ['incomingCheck', 'reduceMissing', 'scopes'] },
  },
  {
    id: 'incoming-debit', kind: 'operation', label: '入窗记账',
    worldMeaning: '入窗字符余额减一，负数表示窗口中有余量。', canonicalCode: 'need[incoming]--',
    links: { sceneIds: ['need-ledger'], skillIds: ['read-incoming-character'], traceFields: ['needEntries', 'changedCode'], referenceStepIds: ['debit-incoming'], mappingEntryIds: ['need-debit'], structuredSlotIds: ['debit-incoming'], semanticChecks: ['debitIncoming'] },
  },
  {
    id: 'window-covered', kind: 'control', label: '完整覆盖条件',
    worldMeaning: '覆盖灯亮起后，左标尺才允许连续收缩。', canonicalCode: 'missing == 0',
    links: { sceneIds: ['coverage-lamp', 'current-window'], skillIds: ['shrink-covered-window'], traceFields: ['missing', 'left', 'right'], referenceStepIds: ['shrink-loop-open', 'shrink-loop-close'], mappingEntryIds: ['shrink'], structuredSlotIds: ['shrink-condition'], semanticChecks: ['shrinkLoop', 'scopes'] },
  },
  {
    id: 'window-length', kind: 'operation', label: '当前窗口长度',
    worldMeaning: '连续窗口从左标尺到右标尺的字符数量。', canonicalCode: 'right - left + 1',
    links: { sceneIds: ['window-measure'], skillIds: ['save-best-window'], traceFields: ['left', 'right'], referenceStepIds: ['measure-window', 'shorter-check-open', 'save-best'], mappingEntryIds: ['record-best'], structuredSlotIds: ['measure-window', 'shorter-condition', 'save-best'], semanticChecks: ['measureWindow', 'shorterCheck', 'saveBest'] },
  },
  {
    id: 'shorter-decision', kind: 'control', label: '更短窗口判断',
    worldMeaning: '只允许严格更短的覆盖窗口替换历史封条。', canonicalCode: 'currentLength < bestLength',
    links: { sceneIds: ['best-seal', 'window-measure'], skillIds: ['save-best-window'], traceFields: ['bestLength', 'left', 'right'], referenceStepIds: ['shorter-check-open', 'save-best', 'shorter-check-close'], mappingEntryIds: ['record-best'], structuredSlotIds: ['shorter-condition', 'save-best'], semanticChecks: ['shorterCheck', 'saveBest', 'scopes'] },
  },
  {
    id: 'outgoing-credit', kind: 'operation', label: '出窗记账',
    worldMeaning: '字符离窗时余额加一，为恢复欠账判断提供新值。', canonicalCode: 'need[outgoing]++',
    links: { sceneIds: ['need-ledger'], skillIds: ['read-outgoing-character'], traceFields: ['needEntries', 'changedCode'], referenceStepIds: ['credit-outgoing'], mappingEntryIds: ['need-credit'], structuredSlotIds: ['credit-outgoing'], semanticChecks: ['creditOutgoing'] },
  },
  {
    id: 'restored-debt', kind: 'control', label: '恢复欠账判断',
    worldMeaning: '出窗后字符余额为正，说明窗口失去一个必要字符。', canonicalCode: 'need[outgoing] > 0',
    links: { sceneIds: ['need-ledger', 'missing-meter'], skillIds: ['read-outgoing-character'], traceFields: ['needEntries', 'missing'], referenceStepIds: ['restore-check-open', 'increase-missing', 'restore-check-close'], mappingEntryIds: ['need-credit'], structuredSlotIds: ['restored-condition', 'increase-missing'], semanticChecks: ['restoreCheck', 'increaseMissing', 'scopes'] },
  },
  {
    id: 'string-length', kind: 'api', label: '字符串长度',
    worldMeaning: '提供需求卡、源文字带边界和无答案哨兵。', canonicalCode: 'text.length()',
    links: { sceneIds: ['source-track', 'target-card'], skillIds: ['initialize-window', 'scan-source'], traceFields: ['source', 'target'], referenceStepIds: ['target-loop-open', 'prepare-window', 'source-loop-open', 'empty-result'], mappingEntryIds: ['length'], structuredSlotIds: ['target-condition', 'window-preparation', 'scan-condition', 'no-answer-condition'], semanticChecks: ['targetLoop', 'prepareWindow', 'sourceLoop', 'emptyResult'] },
  },
  {
    id: 'string-char-at', kind: 'api', label: '按位置读取字符',
    worldMeaning: '按需求卡索引或窗口标尺读取一个字符编码。', canonicalCode: 'text.charAt(index)',
    links: { sceneIds: ['source-track', 'target-card'], skillIds: ['initialize-window', 'read-incoming-character', 'read-outgoing-character'], traceFields: ['incomingCode', 'outgoingCode'], referenceStepIds: ['read-target', 'read-incoming', 'read-outgoing'], mappingEntryIds: ['char-at'], structuredSlotIds: ['read-target', 'read-incoming', 'read-outgoing'], semanticChecks: ['readTarget', 'readIncoming', 'readOutgoing'] },
  },
  {
    id: 'string-substring', kind: 'api', label: '截取连续子串',
    worldMeaning: '按历史封条的起点与终点裁切源文字带。', canonicalCode: 's.substring(start, end)',
    links: { sceneIds: ['best-seal', 'result-tray'], skillIds: [], traceFields: ['bestStart', 'bestLength'], referenceStepIds: ['empty-result', 'return-window'], mappingEntryIds: ['substring'], structuredSlotIds: ['empty-result', 'window-result'], semanticChecks: ['emptyResult', 'returnWindow'] },
  },
  {
    id: 'no-window-boundary', kind: 'boundary', label: '无覆盖窗口',
    worldMeaning: '历史长度仍大于源串长度，说明封条从未写入。', canonicalCode: 'bestLength > s.length()',
    links: { sceneIds: ['best-seal', 'result-tray'], skillIds: [], traceFields: ['bestStart', 'bestLength'], referenceStepIds: ['empty-result'], mappingEntryIds: ['result'], structuredSlotIds: ['no-answer-condition', 'empty-result'], semanticChecks: ['emptyResult'] },
  },
  {
    id: 'method-result', kind: 'output', label: '最小覆盖子串',
    worldMeaning: '出口托盘上的历史最短连续片段，或空片段。', canonicalCode: 'return s.substring(...)',
    links: { sceneIds: ['result-tray'], skillIds: [], traceFields: ['bestStart', 'bestLength'], referenceStepIds: ['empty-result', 'return-window'], mappingEntryIds: ['result', 'substring'], structuredSlotIds: ['empty-result', 'window-result'], semanticChecks: ['emptyResult', 'returnWindow'] },
  },
]
