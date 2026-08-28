# 和为 K 的子数组

## Algorithm Contract

- 输入类型与方法签名：`int subarraySum(int[] nums, int k)`。
- 目标输出或原地修改结果：返回和等于 `k` 的连续非空子数组数量，不修改 `nums`。
- 允许修改的数据：只允许维护局部累计状态与前缀和频次表。
- 时间/空间目标：`O(n)` 时间、`O(n)` 额外空间。
- 必须处理的边界：负数、`k = 0`、重复前缀和、单元素、没有命中、全部命中和空数组防御性用例。

## Learning Goal

- 数据结构：数组、哈希表（前缀和到出现次数）。
- 核心技能：建立起点档案、逐项巡查、更新累计刻度、统计目标区间、登记当前刻度。
- 组合策略：前缀和 + 频次表。
- 玩家最终应能解释的因果关系：若当前前缀为 `prefixSum`，历史中每一个值为 `prefixSum - k` 的前缀都对应一个以当前位置结尾、和为 `k` 的连续子数组；必须先查询旧档案，再登记当前前缀。

## Algorithm Concept Map

- 输入、输出与副作用：读取 `nums` 和 `k`，返回数量，不修改数组。
- 核心运算、控制流、不变量、边界与 API：逐项遍历、`prefixSum += nums[index]`、`needed = prefixSum - k`、`getOrDefault` 查询、答案累加、`put` 更新频次；处理第 `index` 项前，档案只包含该位置之前的前缀。

| Concept ID | Kind | 场景特征 | 标准代码 | 初始化 | 读取/更新规则 | Skill / Trace | Reference / Mapping / Slot / Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `nums-input` | input | 站点数值带 | `nums[index]` | 由方法入参提供 | 每轮读取当前站值 | `scan-values` / `values,currentIndex` | `scan-open,prefix-update` / `nums,index` / `loop,prefix-update` / `scan,prefixUpdate` |
| `target-k` | input | 目标差值牌 | `k` | 由方法入参提供 | 统计目标区间时读取 | `count-matches` / `target` | `needed` / `target` / `needed` / `needed` |
| `scan-index` | state | 当前站指示器 | `index` | `0` | 每轮末尾 `index++` | `scan-values` / `currentIndex` | `scan-open,advance` / `index` / `loop,advance` / `scan,advance` |
| `current-prefix` | state | 累计刻度表 | `prefixSum` | `0` | 每轮加上 `nums[index]` | `accumulate-prefix` / `prefix` | `setup-state,prefix-update` / `prefix` / `setup,prefix-update` / `setup,prefixUpdate` |
| `needed-prefix` | state | 目标旧刻度窗 | `needed` | `0` | `prefixSum - k` | `count-matches` / `needed` | `setup-state,needed` / `needed` / `setup,needed` / `setup,needed` |
| `prefix-frequency` | state | 前缀档案柜 | `frequency` | `{0: 1}` | 查询旧次数；最后把当前前缀次数加一 | `initialize-archive,count-matches,record-prefix` / `frequencyEntries` | `setup-archive,count,record` / `frequency` / `archive,count,record` / `archive,count,record` |
| `answer-count` | output | 命中计数器 | `count` | `0` | 加上目标旧前缀的历史次数 | `count-matches` / `answer` | `setup-state,count,result` / `count` / `setup,count,result` / `setup,count,result` |
| `prefix-difference` | operation | 当前刻度减目标牌 | `prefixSum - k` | - | 每轮前缀更新后计算 | `count-matches` / `formula` | `needed` / `difference` / `needed` / `needed` |
| `frequency-lookup` | api | 调取目标档案 | `frequency.getOrDefault(needed, 0)` | - | 登记当前前缀之前查询 | `count-matches` / `matchedCount` | `count` / `get-or-default` / `count` / `count` |
| `frequency-record` | api | 给当前刻度加一枚档案章 | `frequency.put(prefixSum, frequency.getOrDefault(prefixSum, 0) + 1)` | - | 每轮最后执行 | `record-prefix` / `changedKey` | `record` / `put` / `record` / `record` |
| `iteration-boundary` | boundary | 数值带末端 | `index < nums.length` | `index = 0` | 到达数组长度后停止 | `scan-values` / `currentIndex` | `scan-open,scope-close` / `for` / `loop` / `scan,scope` |
| `method-result` | output | 交付计数 | `return count` | - | 遍历结束后返回 | - / `answer` | `result` / `return` / `result` / `result` |

## World Model

- 场景隐喻：前缀和档案站。每个数组元素是一站发生的数值变化；档案员维护累计刻度和历史刻度档案。
- 可见实体及其代码角色：站点带=`nums`，目标差值牌=`k`，当前站=`index`，累计刻度=`prefixSum`，目标旧刻度=`needed`，档案柜=`frequency`，命中计数器=`count`。
- 初始状态：站点未巡查，累计刻度与答案为 0，档案柜已有 `0 -> 1` 的起点档案。
- 目标状态：所有站点处理完，命中计数等于真实连续子数组数量。
- 合法动作与禁止动作：必须依次累加、求差、查询、计数、登记；禁止先登记当前前缀后查询，因为这会在 `k = 0` 时计算空区间。

## Skill Program

- 技能清单及参数：`initialize-archive`、`scan-values`、`accumulate-prefix`、`count-matches`、`record-prefix`；参数由题目输入和循环上下文提供，不允许改写为固定答案。
- 控制作用域：`scan-values` 创建逐项作用域，内部依次放入更新累计刻度、统计目标区间和登记当前刻度；初始化位于根作用域且在循环之前。
- 技能前置条件：每个动作声明自己需要的输入、档案和上一动作产生的能力。
- 技能执行效果：核心技能内部继续生成独立追踪帧；“统计目标区间”展开为计算 `prefixSum - k`、查询历史次数和累加答案，“逐项巡查”负责读取当前值与推进探针。
- 预演表现：使用固定小数据独立演示技能，不写入玩家程序、正式批次或完成状态。

## Code Practice

- 目标语言与所需语法：Java 受控子集；变量、数组、`while`、赋值、自增、算术、`Map<Integer, Integer>`、`new HashMap<>()`、`getOrDefault`、`put`、`return`。
- 标准变量和标准参考：`nums / k / index / prefixSum / needed / frequency / count`，左侧始终稳定显示标准命名。
- 锁定 scaffold：方法签名、`while`、大括号、缩进和 `return` 外壳锁定。
- 可编辑槽位：档案初始化、状态初始化、循环初始化/条件/前进、前缀更新、目标旧前缀、命中累加、当前前缀登记、返回值。
- 允许的等价实现：合法变量改名；`getOrDefault` 中直接使用 `prefixSum - k`；等价的 `for` 边界和 `count = count + ...` 写法。
- 独立 API 映射：`nums.length`、`Map.getOrDefault`、`Map.put`、`new HashMap<>()` 分别登记。

## Verification

- 手动阶段完成条件：在 `[1, 1, 1]`、`k = 2` 中找齐两个连续区间。
- 自动阶段验证批次：正数重复、复合区间、负数与 `k = 0` 三批。
- 公开代码用例：`[1,1,1],2 -> 2`、`[1,2,3],3 -> 2`、`[1,-1,0],0 -> 3`。
- 隐藏与边界用例：单元素命中/不命中、重复零、负目标、无命中、空数组和经典长例。
- 必须拒绝的典型错误实现：滑动窗口；先登记再查询；未登记 `0 -> 1`；只保存是否出现而非频次；返回最后一次命中而非总数。

## Playbook Coverage

- 适用全部 Required 功能：`manual.direct-entry`、`skill.core-library`、`skill.detail-expansion`、`skill.preview`、映射、空程序、点选/拖放、清空、运行、批次、代码和响应式功能。
- `program.scope-contract` 适用：逐项巡查创建作用域，循环动作依赖上下文能力。
- 产品功能适用：Catalog V2 元数据、真实开放状态、独立路由、真实预览和任意阶段返回。
