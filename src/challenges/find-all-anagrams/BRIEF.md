# 找到字符串中所有字母异位词

## Algorithm Contract

- 输入类型与方法签名：`List<Integer> findAnagrams(String s, String p)`。
- 目标输出：按升序返回 `s` 中所有长度为 `p.length()` 且与 `p` 字母频次完全相同的窗口起点。
- 允许修改的数据：只维护本地频次数组、左右边界和结果列表，不修改输入字符串。
- 时间/空间目标：`O(|s| + |p|)` 时间，固定 26 字母频次数组为 `O(1)` 额外统计空间。
- 必须处理的边界：`p` 长于 `s`、单字符、重复字符、连续重叠命中、完全不命中和命中位于末尾。

## Learning Goal

- 数据结构：字符串、固定长度频次数组、结果列表。
- 核心技能：建立目标频谱、向右扫描源信号、纳入右侧字母、超宽时收缩左侧、匹配时记录起点。
- 组合策略：固定宽度滑动窗口 + 字母频次比较。
- 玩家最终应能解释的因果关系：右侧纳入一个字母后，若窗口超过目标长度，就先扣除左侧字母并推进左边界；窗口宽度正确且两份频谱相等时，当前左边界就是一个答案。

## Algorithm Concept Map

| Concept ID | Kind | 场景特征 | 标准代码 | 初始化 | 读取/更新规则 | Skill / Trace | Reference / Mapping / Slot / Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `source-string` | input | 源信号带 | `s` | 方法入参 | 右探针逐字读取 | `scan-source` / `source` | 源串相关步骤、词典、循环槽位与 `sourceLoop` |
| `pattern-string` | input | 目标信号卡 | `p` | 方法入参 | 建立目标频谱并决定窗口宽度 | `prepare` / `pattern` | 目标串相关步骤、词典、循环与宽度检查 |
| `target-counts` | state | 目标频谱柱 | `target[26]` | 全 0 | 每读一个 `p` 字母对应格加一，之后只读 | `prepare` / `targetCounts` | 初始化、目标计数、比较、数组词典与 `targetCount` |
| `window-counts` | state | 当前窗口频谱柱 | `window[26]` | 全 0 | 进入字符加一，离开字符减一 | `add-incoming`、`if-overflow` / `windowCounts` | 初始化、进出窗口、比较与 `windowCount` |
| `left-index` | state | 窗口左夹具 | `left` | `0` | 窗口超宽且移出旧字符后 `left++` | `if-overflow` / `left` | 准备、窗口宽度、移出、记录与 `leftAdvance` |
| `pattern-index` | state | 目标读头 | `i` | `0` | 建立目标频谱时逐字前进 | `prepare` / `patternIndex` | 目标循环三槽与 `patternLoop` |
| `right-index` | state | 窗口右探针 | `right` | `0` | 遍历 `s` 时每轮加一 | `scan-source` / `right` | 源串循环三槽与 `sourceLoop` |
| `result-indices` | output | 命中索引纸带 | `result` | 空列表 | 频谱匹配时追加 `left`，结束后返回 | `if-match` / `matches` | 初始化、记录、返回、`List.add` 与 `returnResult` |
| `alphabet-offset` | operation | 字母落入 0-25 号频谱格 | `charAt(index) - 'a'` | 无 | 每次读字符时计算 | 三个计数技能 / `activeBucket` | 计数步骤、`charAt` 词典与计数检查 |
| `window-width` | state | 两夹具之间的实时宽度 | `right - left + 1` | `0` | 右探针变化后重新计算，左夹具推进后缩小 | `if-overflow`、`if-match` / `windowWidth` | 两个条件、宽度词典与 `windowWidth` |
| `incoming-count` | operation | 新字母进入扫描窗 | `window[s.charAt(right) - 'a']++` | 无 | 每个源串循环先执行一次 | `add-incoming` / `enteringChar` | 纳入步骤、槽位与 `addIncoming` |
| `overflow-decision` | control | 超宽警示灯 | `windowWidth > p.length()` | 关闭 | 纳入字母后判断 | `if-overflow` / `overflow` | `if` 作用域、条件槽与 `overflowCondition` |
| `outgoing-count` | operation | 左侧字母退出扫描窗 | `window[s.charAt(left) - 'a']--` | 无 | 超宽时在左边界推进前执行 | `if-overflow` / `leavingChar` | 移出步骤、槽位与 `removeOutgoing` |
| `left-advance` | operation | 左夹具向右一格 | `left++` | 无 | 移出旧字符之后执行 | `if-overflow` / `left` | 推进步骤、槽位与 `leftAdvance` |
| `frequency-equality` | control | 两排频谱完全重合 | `Arrays.equals(target, window)` | 假 | 窗口宽度正确时比较 26 格 | `if-match` / `frequenciesMatch` | 匹配条件、`Arrays.equals` 词典与 `matchCondition` |
| `record-index` | operation | 打印命中起点 | `result.add(left)` | 无 | 固定宽度且频谱相等时执行 | `if-match` / `matches` | 记录步骤、`List.add` 词典与 `recordIndex` |
| `string-length` | api | 信号带长度读数 | `s.length()` / `p.length()` | 无 | 循环与窗口宽度判断读取 | 控制技能 / `sourceLength`、`patternLength` | 长度词典与循环/条件检查 |
| `string-char-at` | api | 读取指定位置字母 | `charAt(index)` | 无 | 三个频次更新点读取 | 计数技能 / `activeChar` | `charAt` 词典与计数检查 |
| `arrays-equals` | api | 比较两份完整频谱 | `Arrays.equals(target, window)` | 无 | 固定宽度窗口完成后读取 | `if-match` / `frequenciesMatch` | API 词典、匹配条件与 `matchCondition` |
| `list-add` | api | 向结果纸带追加起点 | `result.add(left)` | 无 | 匹配成立时写入 | `if-match` / `matches` | API 词典、记录槽与 `recordIndex` |

## World Model

- 场景隐喻：“频谱滑窗站”。源字符串是一条持续向右传送的字母信号带，目标串是一张固定频谱卡，左右夹具围成当前扫描窗。
- 可见实体及其代码角色：源字母带=`s`，目标卡=`p`，目标/窗口两排 26 格频谱=`target/window`，左右夹具=`left/right`，命中纸带=`result`。
- 初始状态：两份频谱全 0，左夹具在 0，右探针尚未开始，命中列表为空。
- 目标状态：源信号带扫描结束，纸带按顺序记录全部匹配窗口起点。
- 合法动作与禁止动作：只允许在右侧字符被纳入后判断超宽；超宽时必须先扣除左字符再推进左夹具；窗口长度不足时不得记录；不得排序每个窗口或重新完整计数每个窗口。

## Skill Program

- 技能清单及参数：`prepare`、`scan-source`、`add-incoming`、`if-overflow`、`if-match`，均无玩家参数。
- 控制作用域：`scan-source` 包含三个按顺序执行的核心动作；建立目标频谱位于根流程并先于源串扫描。
- 技能前置条件：纳入字符需要右探针；超宽收缩必须在纳入后执行；匹配记录必须在窗口宽度恢复后执行。
- 技能执行效果：建立目标频谱内部展开目标串遍历与计数；超宽收缩内部展开移出左字符和推进边界；匹配记录内部展开频谱比较与写入结果。
- 预演表现：使用独立演示数据，显示对应字母、频谱格和边界变化，不修改正式程序、批次或验证进度。

## Code Practice

- 目标语言与所需语法：Java 受限子集；新增 `String.length()`、`String.charAt()`、字符字面量、`new int[...]`、`for`、`List<Integer>`、`new ArrayList<>()`、`Arrays.equals` 和 `List.add`。
- 标准变量和标准参考：`s / p / target / window / left / i / right / result`，始终保持稳定。
- 锁定 scaffold：方法签名、两个 `for`、两个 `if`、缩进和全部作用域边界锁定。
- 可编辑槽位：准备变量、两个循环的初始化/条件/更新、目标计数、进入计数、超宽条件、移出计数、左边界推进、匹配条件、记录结果和返回结果。
- 允许的等价实现：变量改名、`+= 1`/`-= 1`、`97` 代替 `'a'`、`Arrays.equals` 参数顺序交换、等价循环变量名。
- 独立 API 映射：`String.length`、`String.charAt`、`new int[26]`、`Arrays.equals`、`new ArrayList`、`List.add`。

## Verification

- 手动阶段完成条件：在 `s = "cbaebabacd"`、`p = "abc"` 上准确选择窗口起点 `0` 与 `6`。
- 自动阶段验证批次：重叠命中、重复字母和尾部命中三组公开批次。
- 公开代码用例：`("cbaebabacd", "abc") -> [0, 6]`、`("abab", "ab") -> [0, 1, 2]`、`("baa", "aa") -> [1]`。
- 隐藏与边界用例：单字符、全重复、模式更长、无命中、多个重叠命中与末尾命中。
- 必须拒绝的典型错误实现：不移出旧字母、移出后不推进左边界、宽度不足时比较、只比较去重集合、记录 `right` 而不是 `left`、每次匹配后清空窗口频谱。

## Feature Coverage

- `catalog.*`：Catalog V2 登记、真实预览、独立路由、开放状态和返回路径。
- `manual.direct-entry`：首屏直接选择匹配窗口。
- `skill.core-library`、`skill.detail-expansion`、`skill.preview`：五项核心技能、完整内部因果帧及无污染预演。
- `mapping.*`：以上概念表与运行帧、参考、词典、槽位、语义检查双向关联。
- `program.*`、`runtime.*`、`batch.*`：空程序、点选/拖放/嵌套/重排、播放/暂停/单步/重置、逐批和全批验证。
- `code.*`：完整参考、独立 API 词典、结构/自由双模式、真实公开/隐藏用例。
- `responsive.primary-task`：桌面双工作区，手机纵向主流程与代码参考/编辑切换。
