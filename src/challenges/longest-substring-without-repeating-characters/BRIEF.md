# 字符灯廊 / 无重复字符的最长子串

## Catalog V2

- 稳定 ID：`longest-substring-without-repeating-characters`
- 顺序：按接入时目录现状确定，不覆盖其他并行新增题目的顺序
- 学习专题：滑动窗口入门
- 数据结构：字符串、字符频次数组
- 解题技巧：滑动窗口、双指针、频次统计
- 学习难度：`intermediate`
- 开放状态：完成 Definition of Done 后为 `available`
- 目标语言：Java
- 阶段数：6
- 预计时长：30 分钟
- 前置关卡：无强制前置
- 路径：`/games/character-corridor/`
- 预览：完成真实浏览器验收后生成，不使用占位图

## Algorithm Contract

- 输入类型与方法签名：`int lengthOfLongestSubstring(String s)`
- 目标输出：返回不含重复字符的最长连续子串长度。
- 允许修改的数据：不修改输入字符串；维护窗口边界、ASCII 字符频次数组和最长记录。
- 时间/空间目标：时间 `O(n)`；频次数组固定 128 项，辅助空间 `O(1)`（相对题目字符集）。
- 必须处理的边界：空串、单字符、全重复、重复字符跨越旧窗口、空格和 ASCII 符号。
- 字符集依据：题目约束只包含英文字母、数字、符号和空格，因此标准参考使用 `int[128]`。

## Learning Goal

- 数据结构：字符串、连续区间、字符频次数组。
- 核心技能：初始化灯廊、扫描直到末尾、重复时收缩窗口、纳入当前字符、更新最长记录。
- 组合策略：滑动窗口 + 双指针 + 频次统计。
- 玩家最终应能解释的因果关系：巡灯员在右边界读取准备纳入的字符；若该字符已在窗口中，守窗员就在左边界逐项清退直到频次归零；纳入后窗口重新满足“字符唯一”不变量，再用 `right - left + 1` 更新历史最长长度。

## Algorithm Concept Map

- 输入、输出与副作用：输入 `s` 只读；输出为整数长度；不修改输入。
- 核心不变量：完成每轮纳入后，`s[left..right]` 内每个字符的频次最多为 1。
- 终止条件：`right == s.length()`。

| Concept ID | Kind | 场景特征 | 标准代码 | 初始化 | 读取/更新规则 | Skill / Trace | Reference / Mapping / Slot / Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `string-input` | input | 字符轨道 | `s` | 方法入参 | 只读 | 初始化/读取；`source` | 准备/读取/API/`initialize,current` |
| `left-boundary` | state | 守窗员与左边界门闸 | `left` | `0` | 清退左端后 `left++` | 初始化/清退/收紧；`left` | 准备/左移/窗口宽度/`initialize,release,moveLeft,width` |
| `right-boundary` | state | 带探照灯的巡灯员 | `right` | `0` | 每轮结束 `right++` | 初始化/读取/巡查；`right` | 准备/外循环/右移/`initialize,scan,moveRight` |
| `frequency-table` | state | 当前窗口字符计数 | `counts` | `new int[128]` | 移出时减一，纳入时加一 | 收缩/纳入；`counts` | 准备/重复判断/移出/纳入/`initialize,duplicate,release,admit` |
| `current-character` | state | 巡灯员探照灯读数 | `current` | 每轮读取 | `s.charAt(right)` | 扫描；`currentCode` | 读取/重复判断/纳入/`readCurrent` |
| `best-length` | state | 历史最长读数与区间 | `best` | `0` | 纳入后取 `Math.max` | 更新最长；`best,bestStart,bestEnd` | 准备/更新/返回/`initialize,updateBest,return` |
| `scan-boundary` | boundary | 巡灯员尚未越过轨道 | `right < s.length()` | - | 每轮检查 | 扫描循环 | 外循环/`scan` |
| `duplicate-decision` | control | 重复警报 | `counts[current] > 0` | - | 重复仍存在就继续收缩 | 重复循环；`duplicate` | 内循环/`duplicate` |
| `release-left-character` | operation | 守窗员清退左端字符 | `counts[s.charAt(left)]--` | - | 先减频次 | 重复时收缩；`changedCode` | 移出槽位/`release` |
| `move-left-boundary` | operation | 守窗员收紧左边界 | `left++` | - | 必须在移出后 | 重复时收缩；`left` | 左移槽位/`moveLeft` |
| `admit-current-character` | operation | 当前字符进入窗口 | `counts[current]++` | - | 重复消失后执行 | 纳入；`counts` | 纳入槽位/`admit` |
| `window-width` | operation | 当前点亮字符数量 | `right - left + 1` | - | 纳入后计算 | 更新最长；`windowLength` | 更新槽位/`updateBest` |
| `string-length` | api | 字符轨道总长度 | `s.length()` | - | 外循环读取 | 扫描 | API 词典/外循环/`scan` |
| `string-char-at` | api | 按编号读取字符 | `s.charAt(index)` | - | 读取当前和左端字符 | 读取/移出 | API 词典/读取与移出/`readCurrent,release` |
| `array-access` | api | 按字符编码读写频次 | `counts[code]` | - | 判断、减一、加一 | 重复/移出/纳入 | API 词典/对应槽位/`duplicate,release,admit` |
| `method-result` | output | 最长记录交付 | `return best` | - | 扫描结束后返回 | 结果帧 | 返回槽位/`return` |

## World Model

- 场景隐喻：字符依次经过一段可伸缩的“灯廊”；守窗员驻守窗口左缘，清退造成重复的旧字符；巡灯员沿上轨用探照灯逐格读取新字符。两名角色之间是当前候选子串，窗口中的字符必须保持唯一。
- 可见实体及代码角色：字符轨道对应 `s`；带门闸护臂的守窗员对应 `left`；带探照灯的巡灯员对应 `right`；窗口计数台对应 `counts`；巡灯员读数对应 `current`；最长记录尺对应 `best`。
- 初始状态：守窗员与巡灯员同时位于 0 号站，计数台为空，最长记录为 0。
- 目标状态：扫描完整条轨道，保留历史最长无重复窗口长度。
- 合法动作：巡灯员读取当前字符；重复时守窗员清退左端并收紧左边界；纳入当前字符、更新记录后巡灯员继续前进。
- 禁止动作：重复尚未移除就纳入；未移出字符就移动左边界；纳入前更新长度；更新记录前推进扫描头。

## Skill Program

- 技能清单：`初始化灯廊`、`扫描直到末尾`、`重复时收缩窗口`、`纳入当前字符`、`更新最长记录`。
- 控制作用域：`扫描直到末尾` 包含三个玩家需要排序的核心动作；读取当前字符和扫描头前进由该核心循环在执行时展开，“重复时收缩窗口”内部展开移出左端字符与推进左边界。
- 技能前置条件与执行效果：题目解释器按上述核心顺序检查，错误关联具体技能实例；内部帧仍逐步显示字符读取、频次变化、边界移动和窗口宽度计算。
- 预演表现：每项技能使用独立短片；不写入正式程序、不修改正式字符串、不改变批次结果。

## Code Practice

- 目标语言与所需语法：Java 受限子集；`int`、`int[]`、`while`、赋值、数组访问、自增自减、比较、算术、`Math.max`、`String.length()`、`String.charAt()`、`new int[...]`、`return`。
- 标准变量：`s / left / right / counts / current / best`。
- 锁定 scaffold：方法签名、外层 `while`、内层 `while`、缩进和大括号固定。
- 可编辑槽位：准备状态、扫描条件、读取当前字符、重复条件、移出左端、左移、纳入、更新最长、右移、返回结果。
- 允许的等价实现：变量改名；`+= 1` 与 `++`；`counts[current] != 0`；`Math.max` 参数交换；在保持数据流和更新顺序时接受等价比较。
- 独立 API 映射：`String.length()`、`String.charAt()`、`new int[...]`、数组访问、`Math.max` 分别登记。

## Verification

- 手动阶段完成条件：选中的连续窗口无重复，且长度等于当前字符串的真实最长值。
- 自动阶段验证批次：`abcabcbb -> 3`、`bbbbb -> 1`、`pwwkew -> 3`。
- 公开代码用例：同上三组。
- 隐藏与边界用例：空串、单字符、`dvdf`、`abba`、`tmmzuxt`、包含空格和符号的 ASCII 字符串。
- 必须拒绝：遇到重复只移动一次；移出后未更新频次；先计算长度再收缩；忘记 `+ 1`；右指针不前进；只处理相邻重复；固定变量名匹配。
- 功能 ID：全部 Product/Required 功能；`skill.core-library`、`skill.detail-expansion` 与 `program.scope-contract` 适用。
