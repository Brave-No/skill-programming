# 最小覆盖子串

## Algorithm Contract

- 输入类型与方法签名：`String minWindow(String s, String t)`。
- 目标输出或原地修改结果：返回 `s` 中包含 `t` 全部字符及重复次数的最短连续子串；不存在时返回空字符串。
- 允许修改的数据：只修改本地计数表、窗口边界、欠账数量和最佳答案状态，不修改输入字符串。
- 时间/空间目标：`O(|s| + |t|)` 时间；针对题目限定的英文字母使用固定大小计数数组。
- 必须处理的边界：无可行窗口、单字符、答案位于首部/尾部、目标含重复字符、大小写敏感、完整字符串恰好为答案。

## Learning Goal

- 数据结构：字符串、固定大小字符计数数组。
- 核心技能：建立目标欠账、向右扩张窗口、纳入右侧字符、覆盖后持续收缩、记录更短窗口、移出左侧字符。
- 组合策略：可变长度滑动窗口。
- 玩家最终应能解释的因果关系：右侧扩张让窗口逐步覆盖目标；只有欠账为零时才可记录答案并移动左侧；移出关键字符会恢复欠账并停止收缩。

## Algorithm Concept Map

- 输入、输出与原地副作用：`s` 是被扫描文本，`t` 是覆盖目标；算法返回 `s` 的一个子串且不修改输入。
- 核心运算、控制流、不变量、边界与 API：计数表保存“窗口还欠多少个该字符”；`missing` 是总欠账；外层循环扩张右边界，内层循环在完全覆盖时收缩；`bestStart / bestLength` 保存历史最短窗口；使用 `length()`、`charAt()` 和 `substring()`。

| Concept ID | Kind | 场景特征 | 标准代码 | 初始化 | 读取/更新规则 | Skill / Trace | Reference / Mapping / Slot / Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `source-text` | input | 扫描带 | `s` | 方法入参 | 读取字符与返回子串 | 扫描/窗口帧 | source / preparation / source |
| `target-text` | input | 需求卡 | `t` | 方法入参 | 逐字符登记需求 | 登记帧 | target / target-loop / target |
| `need-table` | state | 字符欠账格 | `need` | `new int[128]` | 入窗减一，出窗加一 | 登记/入窗/出窗 | need / need-debit / need-credit |
| `missing-count` | state | 总欠账读数 | `missing` | `t.length()` | 补齐时减一，失去关键字符时加一 | 补齐/恢复帧 | missing / cover-missing / restore-missing |
| `left-boundary` | state | 左标尺 | `left` | `0` | 覆盖成立时逐格右移 | 收缩帧 | left / left-advance / leftAdvance |
| `right-boundary` | state | 右标尺 | `right` | `0` | 外层循环每轮右移 | 扩张帧 | right / right-advance / rightAdvance |
| `best-window` | state | 历史最短封条 | `bestStart / bestLength` | `0 / s.length() + 1` | 当前窗口更短时整体更新 | 记录帧 | best / record-best / recordBest |
| `window-covered` | control | 覆盖灯 | `missing == 0` | 初始通常未覆盖 | 为零时进入收缩作用域 | 收缩控制 | shrink / shrink-condition / shrink |
| `incoming-character` | operation | 右侧入窗字符 | `s.charAt(right)` | 每轮读取 | 先判断欠账，再扣减计数 | 补齐/入窗帧 | incoming / incoming / coverMissing + debitNeed |
| `outgoing-character` | operation | 左侧出窗字符 | `s.charAt(left)` | 每轮收缩读取 | 先恢复计数，再判断是否重建欠账 | 出窗/恢复帧 | outgoing / outgoing / creditNeed + restoreMissing |
| `string-length` | api | 扫描带长度 | `s.length()` | - | 控制边界与无答案哨兵 | 外层循环 | length / preparation / prepare |
| `string-char-at` | api | 读取字符 | `s.charAt(index)` | - | 读取目标、入窗和出窗字符 | 多阶段 | charAt / multiple / multiple |
| `string-substring` | api | 裁切答案 | `s.substring(...)` | - | 按历史最短边界返回 | 返回帧 | substring / result / return |
| `method-result` | output | 出口托盘 | `return ...` | - | 有答案返回最短窗口，否则返回空串 | 完成帧 | result / result / return |

## World Model

- 场景隐喻：文本经过一台“窗口校准台”，左右标尺框住当前连续片段；上方需求卡显示每个目标字符的剩余欠账，历史最短封条固定在扫描带下方。
- 可见实体及其代码角色：字符格对应 `s[index]`；左/右标尺对应窗口边界；欠账格对应 `need[char]`；总欠账对应 `missing`；历史封条对应 `bestStart / bestLength`。
- 初始状态：窗口为空，左侧在 0，右侧等待读取，欠账来自 `t`，历史答案为空。
- 目标状态：扫描结束后，历史封条覆盖所有目标字符且长度最短。
- 合法动作与禁止动作：只能连续扩张或从左侧连续收缩；不能跳过中间字符、不能在仍有欠账时记录答案、不能先移动左侧再恢复出窗字符的计数。

## Skill Program

- 技能清单及参数：共 6 项核心技能，对应目标建账、窗口扩张、右侧入窗、覆盖收缩、最短记录和左侧出窗；首版无玩家参数。
- 控制作用域：“向右扩张窗口”拥有每个源字符的作用域；“覆盖后持续收缩”嵌套其中，并包含记录更短窗口和移出左侧字符。
- 技能前置条件：建立目标欠账必须先完成；每轮先纳入右侧字符，再判断是否覆盖；覆盖时必须先比较并记录更短窗口，再完成左侧出窗。
- 技能执行效果：每个核心技能内部继续生成独立追踪帧；目标遍历、字符读写、欠账增减和左右边界前进均完整可见，但不再占用玩家技能卡。
- 预演表现：每项技能在固定短文本上演示，不写入正式程序、批次或验证状态。

## Code Practice

- 目标语言与所需语法：受限 Java；整数与整数数组、字符串入参、新建计数数组、数组访问、`while`、`if/else`、赋值/自增减、`length()`、`charAt()`、`substring()`、返回字符串。
- 标准变量和标准参考：`s / t / need / targetIndex / left / right / missing / bestStart / bestLength / incoming / outgoing / currentLength`。
- 锁定 scaffold：目标登记循环、右侧扫描循环、覆盖收缩循环、判断与作用域固定。
- 可编辑槽位：准备计数表、目标登记、窗口状态、入窗补齐、入窗记账、覆盖条件、最短记录、出窗记账、欠账恢复、左移、右移、返回结果。
- 允许的等价实现：本地变量可改名；`x++` 与 `x += 1` 等价；比较方向可交换；在保持数据流和更新顺序时允许拆分声明。
- 独立 API 映射：`String.length()`、`String.charAt()`、`String.substring()`、整数计数数组分别建词典条目。

## Verification

- 手动阶段完成条件：玩家选中的连续片段真实覆盖目标且长度等于最优答案。
- 自动阶段验证批次：标准混合字符、重复目标字符、答案位于尾部三组。
- 公开代码用例：`ADOBECODEBANC / ABC -> BANC`、`a / a -> a`、`a / aa -> ""`。
- 隐藏与边界用例：空源文本、重复字符、多解取最短、大小写敏感、完整字符串答案、答案位于首尾。
- 必须拒绝的典型错误实现：只判断字符种类不判断重复次数；覆盖后不收缩；先移动左边界再恢复出窗计数；入窗先扣减再判断欠账；返回最后一个可行窗口而非历史最短；只通过公开示例的固定返回。

## Feature Coverage

- 产品入口：`catalog.challenge-selection`、`catalog.challenge-return`、`catalog.metadata-v2`、`catalog.truthful-state`、`catalog.scalable-browse`、`catalog.route-integrity` 由统一目录条目、`/games/minimum-window/`、真实预览和六题专题筛选验收覆盖。
- 学习与映射：`manual.direct-entry`、`skill.core-library`、`skill.detail-expansion`、`skill.preview`、`mapping.concept-inventory`、`mapping.state-lifecycle`、`mapping.causal-chain`、`mapping.stage-parity` 由字符带/欠账台、6 项核心技能、独立预演、概念链接测试和逐帧状态更新覆盖。
- 编排与运行：`program.empty-default`、`program.place-click`、`program.place-drag`、`program.scope-contract`、`program.clear`、`program.edit-invalidates-verification`、`runtime.playback`、`runtime.edit-lock` 由空程序、两层核心作用域、桌面拖放、手机点选、播放/暂停/单步/重置和编辑失效覆盖。
- 批次与代码：`batch.sequential`、`batch.verify-all`、`batch.inspect-failure`、`batch.reverify`、`code.reference`、`code.dictionary`、`code.dual-mode`、`code.run-submit` 由三批文字带、首个失败数据、重新验证、24 项结构语义、自由模式与 10 个公开/隐藏用例覆盖。
- 完成与响应式：`feedback.completion-celebration`、`responsive.primary-task` 直接复用唯一共享通关组件，首次真实 `10/10` 通过时先持久化再展示；重复提交和刷新不重播，桌面 `1440 x 1000` 与手机 `390 x 844` 无横向溢出。
