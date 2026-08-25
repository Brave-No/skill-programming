# 技能编程

把算法思考过程转化为可操作、可观察、可调试的世界规则，并在最后将场景动作映射为真实代码。

## 当前应用

- 仓库根目录：`rainline-valley`，接雨水关卡“雨线峡谷”。
- `apps/zero-warehouse`：移动零关卡“零号仓库”，包含 V1、V2 和代码实战阶段。
- `work` 与 `apps/zero-warehouse/work`：正式浏览器验收脚本。
- `AGENTS.md`、`CHALLENGE_PLAYBOOK.md`、`FRONTEND.md`、`会话协作记录.md`：项目规则、交付流程和协作记录。

## 本地运行

雨线峡谷：

```bash
npm install
npm run dev
```

零号仓库：

```bash
cd apps/zero-warehouse
npm install
npm run dev
```

两个应用都提供 `npm test` 和 `npm run build`。
