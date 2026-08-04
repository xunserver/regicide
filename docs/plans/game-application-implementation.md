# game-application 实施计划

## 目标

新增框架无关的 `@regicide/game-application` 包，实现本地单人游戏的应用编排层。该包独占运行中的 core 状态，通过端口协调存档和随机种子，并向任意 H5 UI 提供同步、可判别、可测试的会话 API。

本轮交付完成后，浏览器 UI 可以在不直接调用 `dispatch` 的前提下接入 `LocalGameSession`；真实 `localStorage` 和 Web Crypto 适配器将在建立 `apps/web` 时实现。

## 范围约束

### 本轮包含

- `packages/game-application` 包、公开 API 和单元测试。
- `GameSaveStore`、`GameSeedSource` 端口及测试 fake。
- `LocalGameSession` 状态机、单人意图映射、保存后提交语义和外部变化失效。
- pnpm workspace、根脚本、TypeScript、ESLint、Vitest 和覆盖率接入。
- 使实现后的公开类型与架构文档保持一致。

### 本轮不包含

- React 或其他 UI 框架、页面、组件、样式和动画。
- `apps/web`、真实 `localStorage`、`storage` 事件或 Web Crypto 适配器。
- 网络、服务端、身份、房间、PWA 或 Service Worker。
- CLI 改造；`packages/game-cli` 必须保持行为不变。
- core 规则重写、事件溯源、多存档槽或存档迁移。

## 完成定义

- `@regicide/game-application` 只依赖 `@regicide/game-core`，不导入 DOM、React、Node 或浏览器 API。
- 所有公开操作同步返回可判别结果，没有无实际工作的 `Promise`。
- UI 无法从公开 API 提交 `actorId`、多人命令或直接替换 canonical `GameState`。
- core accepted transition 只有在存档成功后才成为当前状态；失败时原状态和事件语义不变。
- 初始化、恢复、损坏存档、首次新局、替换、终局、外部变化和销毁均有确定状态转换。
- 所有新增分支有确定性测试，根目录 `pnpm run check` 通过。

## 详细步骤

### 0. 基线与保护

- [x] 运行 `git status --short`，记录已有未提交文档，禁止覆盖或清理它们。
- [x] 运行 `pnpm run check`，确认实现前基线通过。
- [x] 阅读 `AGENTS.md`、`CONTEXT.md`、本架构文档和 ADR 0003、0004、0007 至 0028。
- [x] 阅读 core 的 `types.ts`、`state.ts`、`rules.ts` 与 `index.ts`，只使用公开 API。
- [x] 确认 CLI 是范围外消费者；不要移动、重构或复用 CLI 交互代码。

验收：开始编码前可以准确说明 core 的 accepted/rejected 不变量和应用层新增的不变量。

### 1. 创建 workspace 包

- [x] 在 `pnpm-workspace.yaml` 中加入 `packages/game-application`。
- [x] 创建 `packages/game-application/package.json`：
  - 名称为 `@regicide/game-application`。
  - `private: true`、ES module、入口导出 `src/index.ts`。
  - 运行时依赖仅包含 `@regicide/game-core: workspace:*`。
  - 提供 `build`、`lint`、`lint:fix`、`typecheck`、`test` 和 `test:coverage`。
  - Vitest 与 coverage 版本沿用 core，避免引入不同测试栈。
- [x] 创建 `tsconfig.json`，继承 `tsconfig.library.json`，只使用 `ES2022` lib，不加入 DOM 或 Node types。
- [x] 创建 `vitest.config.ts`，覆盖率只统计 application 源码，排除纯类型和 barrel 文件。
- [x] 更新根 `eslint.config.ts`，让 application 源码和测试进入 typed lint；React、React DOM 和 `apps/*` 依赖限制同时适用于 core 与 application。
- [x] 更新根 `test`、`test:coverage`、`test:watch`，同时覆盖 core 和 application，不能降低已有 core 检查。
- [x] 运行 `pnpm install` 更新 lockfile 和 workspace 链接。

验收：空包可以独立完成 lint、typecheck、test 和 build，根脚本能够发现它。

### 2. 定义公开领域边界

建议文件：

```text
packages/game-application/src/
├── index.ts
├── player-intent.ts
├── session-snapshot.ts
├── operation-results.ts
├── solo-game.ts
└── ports/
    ├── game-save-store.ts
    └── game-seed-source.ts
```

- [x] 定义 `PlayerIntent`，只允许：
  - `play-cards { cardIds }`
  - `yield`
  - `discard-for-damage { cardIds }`
  - `use-solo-jester { cardId }`
- [x] 不在 `PlayerIntent` 中暴露 `actorId` 或 `choose-next-player`。
- [x] 定义稳定的单人玩家 ID 和创建配置；该配置只能由 application 使用，不能由 UI 传入。
- [x] 定义 deep-readonly 的公开 `SessionSnapshot`：
  - `uninitialized`
  - `no-game`
  - `active { game }`
  - `unrecoverable-save { reason }`
  - `load-failed { reason }`
  - `stale { previousGame? }`
- [x] 保证 `getSnapshot()` 返回值在状态未变化时引用稳定，便于 UI external-store 集成。
- [x] 定义 `GameSaveStore` 同步端口：
  - `load()` 返回 `empty | loaded | unrecoverable | failed`。
  - `save(game)` 返回 `saved | failed`。
  - `clear()` 返回 `cleared | failed`。
  - `onExternalChange(listener)` 返回 unsubscribe。
- [x] `loaded` 只代表已经过 adapter JSON、版本和 `parseGameState` 校验的 `GameState`。
- [x] application 再校验产品不变量：恰好一个固定本地玩家，且不处于多人专用决策；不符合时进入 `unrecoverable-save`。
- [x] 定义 `GameSeedSource.nextSeed(): string | number`。
- [x] 为初始化、重试、创建、清理和执行意图定义可判别结果：
  - 成功结果包含最终 snapshot。
  - accepted execute 额外包含有序 `GameEvent[]`。
  - core 拒绝包含 `RejectionReason`、旧 snapshot，事件固定为空。
  - 存储失败包含稳定错误分类和旧 snapshot，事件固定为空。
  - 会话状态不允许该操作时返回 application rejection，不 throw。
- [x] 只从 `src/index.ts` 导出 UI 和 adapter 实现真正需要的公开类型；内部 helper 不导出。
- [x] 提供接受 `ReadonlyGameState` 的单人查询门面，至少覆盖合法玩家意图、敌人状态和反击伤害，避免 UI 为调用 core 查询而去除只读类型。

验收：仅通过公开类型即可实现 UI 调用方、fake store 和 seed source，且无法构造多人应用意图。

### 3. 实现 LocalGameSession 基础设施

建议文件：

```text
packages/game-application/src/
├── local-game-session.ts
├── intent-to-command.ts
├── readonly.ts
└── session-errors.ts
```

- [x] 构造函数只注入 `GameSaveStore` 和 `GameSeedSource`，不读存档、不取 seed、不注册监听。
- [x] 初始 snapshot 固定为 `uninitialized`。
- [x] 实现 `getSnapshot()`，不泄漏内部可变容器。
- [x] 实现 `subscribe(listener)`：
  - 返回幂等 unsubscribe。
  - 同一监听器重复退订无错误。
  - 只在 committed snapshot/status 真正变化时通知。
  - 通知顺序确定，不让监听器异常把已提交操作伪装成失败。
- [x] 增加内部同步操作 guard，拒绝监听回调造成的嵌套 mutation；不把 guard 暴露为 UI loading 状态。
- [x] 实现幂等 `dispose()`，取消 store 外部变化监听并拒绝后续 mutation。
- [x] 不实现全局 singleton；实例所有权属于未来 H5 composition root。

验收：构造和读取没有副作用，快照引用稳定，订阅和销毁不会泄漏监听器。

### 4. 实现初始化和恢复状态机

- [x] `initialize()` 只允许从 `uninitialized` 调用。
- [x] 初始化时注册一次外部变化监听，并调用 `store.load()`。
- [x] `empty` 转为 `no-game`。
- [x] `loaded` 经过单人产品不变量检查后转为 `active`。
- [x] adapter 报告 `unrecoverable` 或 application 发现非单人状态时，转为 `unrecoverable-save`。
- [x] `failed` 转为 `load-failed`，保留稳定错误分类。
- [x] 恢复任何状态都不产生或返回历史 `GameEvent[]`。
- [x] `retryLoad()` 只允许从 `load-failed` 调用，不重复注册监听：
  - 重试成功按 load 结果进入相应状态。
  - 再次失败仍停留 `load-failed` 并更新结果。
- [x] 外部变化回调把任何未销毁会话转为 `stale`，可保留先前 game 仅供展示。
- [x] `stale` 后拒绝 execute、创建、替换和清理，不做自动 reload 或 merge。

验收：每个 load 结果对应唯一状态；恢复路径没有 core 事件和隐式删除。

### 5. 实现对局生命周期操作

- [x] `startNewGame()` 只允许从 `no-game` 调用。
- [x] `replaceWithNewGame()` 只允许从 `active` 调用；方法本身不负责 UI 弹窗。
- [x] 两个创建操作都按相同顺序执行：
  1. 调用 seed source。
  2. 使用固定单人配置调用 `createGame`。
  3. 将初始状态视为 candidate。
  4. 调用 `store.save(candidate)`。
  5. 保存成功后替换 snapshot 并通知订阅者。
  6. 保存失败时保留原 snapshot，不通知状态变化。
- [x] 不在保存前清理旧存档；替换使用同一单槽 save 操作。
- [x] `clearUnrecoverableSave()` 只允许从 `unrecoverable-save` 调用：
  - clear 成功进入 `no-game`。
  - clear 失败保留 `unrecoverable-save`。
  - 不自动调用 `startNewGame`。
- [x] 胜负状态仍属于 `active`，只能通过 `replaceWithNewGame` 开始下一局。

验收：任何失败都不会让 UI snapshot 超前于持久化事实。

### 6. 实现玩家意图事务

- [x] `execute(intent)` 只在 `active` 中运行；规则是否合法仍由 core 判定，不在 application 复制规则。
- [x] application 用固定本地 actor 把四种 `PlayerIntent` 映射为对应 `GameCommand`。
- [x] 调用 core `dispatch(currentGame, command)`。
- [x] core rejected：
  - 返回 `rejected` 和 core reason。
  - snapshot 保持同一已提交引用。
  - 不调用 store。
  - 不通知 snapshot 订阅者。
  - 不交付事件。
- [x] core accepted：
  - 把 state/events 保存在局部 candidate 中。
  - 先调用 `store.save(candidate.state)`。
  - save 失败时丢弃 candidate，返回 `storage-error`、旧 snapshot 和空事件。
  - save 成功后才替换内部状态、通知订阅者，并在结果中交付 candidate events。
- [x] 已结束 game 的 execute 继续交给 core 返回 `game-over`，不复制规则状态判断。
- [x] 事件只存在于该次 committed result；不写入 snapshot，不建立 event history 或 replay bus。

验收：顺序严格为 `core -> save -> commit snapshot -> return events`，所有 rejection 都保持输入事实。

### 7. 建立测试工具和矩阵

建议测试结构：

```text
packages/game-application/tests/
├── fakes/
│   ├── fake-game-save-store.ts
│   └── fixed-game-seed-source.ts
├── initialization.test.ts
├── lifecycle.test.ts
├── execution.test.ts
├── queries.test.ts
├── subscriptions.test.ts
└── public-api.test.ts
```

- [x] Fake store 可以预设每次 load/save/clear 结果，记录有序调用，并主动触发 external change。
- [x] Fake store 暴露观察点，验证 save 执行期间 session 仍返回旧 snapshot。
- [x] Fixed seed source 记录调用次数，确保恢复和失败重试不会不必要取 seed。
- [x] 初始化测试：empty、valid solo、invalid envelope result、invalid player configuration、read failure、retry success、retry failure。
- [x] 生命周期测试：首次创建、首次保存失败、正常替换、替换保存失败、显式清理、清理失败、终局恢复。
- [x] 执行测试：四种 intent 映射、只读查询门面、core rejection、accepted save、accepted save failure、ordered events、game-over。
- [x] 订阅测试：引用稳定、成功通知一次、拒绝不通知、保存失败不通知、unsubscribe、external stale、dispose、reentrant mutation guard。
- [x] 不变量测试：无 actor 输入、无多人 intent、非 active 状态均拒绝、stale 后不再写 store。
- [x] 使用完整状态断言，而不是只断言少数字段；涉及事件时断言完整有序数组。
- [x] 测试全部使用固定 seed 和确定 fake，不依赖时间、随机、DOM 或网络。
- [x] 为 application 设置合理的高覆盖率门槛；不得通过 exclude 规避有行为的源码。

验收：失败路径证明旧 snapshot 引用和 store 调用数不变，accepted 路径证明保存先于发布。

### 8. 文档与质量门

- [x] 根据最终导出的类型名更新 `docs/architecture/local-solo-application.md` 的接口草图，不能让文档描述不存在的 API。
- [x] 仅在实现发现真正的新架构决策时新增 ADR；普通文件布局不新增 ADR。
- [x] 检查 `CONTEXT.md` 用词与代码一致，尤其是“玩家意图”“应用层提交”“会话快照”。
- [x] 运行：

```bash
pnpm install
pnpm --filter @regicide/game-application lint
pnpm --filter @regicide/game-application typecheck
pnpm --filter @regicide/game-application test:coverage
pnpm --filter @regicide/game-application build
pnpm run check
```

- [x] 检查 `git diff --check` 和 `git status --short`。
- [x] 确认没有修改 CLI 行为，没有引入 DOM/React/网络/PWA 依赖，没有降低 core 覆盖率门槛。
- [x] 最终报告新增公开 API、关键事务不变量、测试数量、覆盖率和仍然延后的浏览器适配工作。

验收：根质量门全绿，工作区只有本计划范围内的变更。

## 后续里程碑，不在本轮执行

建立 `apps/web` 后再实现：

1. `LocalStorageGameSaveStore`：固定 key、versioned envelope、JSON parse/stringify、`parseGameState`、Web Storage 异常映射和 `storage` 监听。
2. `BrowserGameSeedSource`：用 `crypto.getRandomValues` 产生 seed。
3. Composition root：每页创建一个 session，initialize、subscribe 和 dispose。
4. UI integration：snapshot external store、确认弹窗、一次性事件动画和错误恢复。
5. 浏览器集成测试：刷新恢复、损坏存档、写失败和多标签页 stale。
