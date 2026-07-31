# Regicide

面向 H5 的卡牌游戏仓库，使用 pnpm workspace、Turborepo、Vite、React 和 TypeScript。

## 架构

```text
@regicide/web
    ↓
@regicide/game-ui
    ↓
@regicide/game-application
    ↓
@regicide/game-core

@regicide/common（纯 TypeScript 公共能力，按需被其他模块依赖）
```

- `common`：无业务语义的纯 TypeScript 工具和公共类型，不依赖其他模块。
- `game-core`：纯 TypeScript 游戏状态与规则，不允许依赖 React、DOM 或外层 package。
- `game-application`：接收命令、维护对局会话、编排核心规则，不依赖 React。
- `game-ui`：React 组件、Provider、Hooks、样式和动画，仅通过 application 访问游戏。
- `apps/web`：Vite H5 入口，负责装配依赖和提供浏览器运行环境。

## 目录

```text
.
├── apps/
│   └── web/
│       ├── public/
│       │   └── game-assets/
│       └── src/
├── packages/
│   ├── common/
│   ├── game-core/
│   ├── game-application/
│   └── game-ui/
├── tooling/
│   ├── eslint/
│   ├── stylelint/
│   └── typescript/
├── pnpm-workspace.yaml
└── turbo.json
```

## 开始

```bash
pnpm install
pnpm run dev
```

## 工程检查

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run format:check
```

提交前运行完整检查：

```bash
pnpm run check
```

自动修复：

```bash
pnpm run lint:fix
pnpm run format
```

## 静态资源

- 在代码或 CSS 中静态引用、需要哈希的资源放在对应 package 的 `src/assets`。
- 必须保留文件名或通过运行时清单加载的资源放在 `apps/web/public/game-assets`。
- 子路径部署时通过 `VITE_BASE_PATH` 设置 Vite 的 `base`。
