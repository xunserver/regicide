# Card Deck Pipeline

一个用于批量生成**风格一致卡牌插画**的混合编排系统。确定性脚本负责队列、
并发、重试、状态恢复、文件与版本记录；编排 Agent 负责继承视觉规则、编译提示词、
视觉审核和定向返工。

实现默认适配 OpenAI-compatible API，已预置第三方服务地址和
`gpt-image-2` 模型名，但不会把 API 密钥写进仓库。

## 它解决什么

- 54 张牌使用同一份 Art Bible，并按全局、阵营、卡种、角色、单卡逐层继承规则。
- Prompt 由结构化数据确定性编译，避免每张牌自由发挥导致画风漂移。
- SQLite 状态机保存每次生成、提示词、模型元数据、QA、错误与人工决策。
- 中断后可续跑；失败自动重试；视觉 QA 失败后只添加一条定向返工指令。
- 支持参考图。如果服务兼容 `/v1/images/edits`，可启用参考图编辑模式。
- 支持可选视觉模型做语义 QA；未配置时仍执行尺寸、文件完整性、空白图检查。
- 人工批准是默认发布门槛，避免自动 QA 把低质量卡牌直接当成最终资产。
- 确定性卡框渲染把标题和版式与 AI 插画分离，保证文字、边框像素级一致。
- 可导出完整审计 JSON 和整副牌 contact sheet。

## 架构

```text
deck.json + art_bible.json
            │
            ▼
     Prompt Compiler
            │
            ▼
  Orchestrator / State Machine ───── SQLite production ledger
            │
            ▼
 OpenAI-compatible image adapter
            │
            ▼
 deterministic QA → optional vision QA
            │
       ┌────┴────┐
       │         │
    通过        返工
       │         └── precise revision instruction ──┐
  human review                                      │
       │                                            │
    approved                                  regenerate
```

## 五分钟开始

需要 Python 3.11 或更新版本。

```bash
cd card-deck-pipeline
python3 -m venv .venv
.venv/bin/python -m pip install -e .

# 直接使用仓库内的 54 张示例
cp .env.example examples/four-courts/.env
# 编辑 .env，只在本机填入 OPENAI_API_KEY

# 先检查提示词，不产生费用
.venv/bin/cardpipe \
  --project examples/four-courts/project.json \
  run --dry-run --card spades_ace

# 先做一张样卡；确认服务参数正确
.venv/bin/cardpipe \
  --project examples/four-courts/project.json \
  run --card spades_ace --limit 1
```

也可以初始化一副独立的新牌组：

```bash
.venv/bin/cardpipe init /path/to/my-deck
```

这会生成：

```text
my-deck/
├── project.json       # 服务参数、队列策略、工作目录
├── art_bible.json     # 全局、阵营、卡种、角色视觉规则
├── deck.json          # 54 张结构化卡牌意图
└── references/        # 已批准的风格/阵营/角色锚点图
```

## 推荐制作顺序

不要直接生成 54 张。先锁定视觉锚点：

```bash
# 每个阵营一张 + Joker，一共五张
.venv/bin/cardpipe --project project.json run \
  --card spades_ace \
  --card hearts_ace \
  --card diamonds_ace \
  --card clubs_ace \
  --card joker_1 \
  --limit 5
```

查看生成状态：

```bash
.venv/bin/cardpipe --project project.json status
```

认可某个版本：

```bash
.venv/bin/cardpipe --project project.json approve spades_ace
.venv/bin/cardpipe --project project.json approve hearts_ace --attempt 2
```

如果画面方向不对，给一条只描述差异的返工指令：

```bash
.venv/bin/cardpipe --project project.json reject spades_ace \
  "保持构图与人物不变，把冷蓝月光改弱，并恢复银灰色盔甲"
.venv/bin/cardpipe --project project.json run --card spades_ace
```

样卡批准后，把它们复制到 `references/`，在 `art_bible.json` 中填写
`reference_images`、阵营的 `reference_images` 或角色的 `reference_images`。
如果第三方服务支持图片编辑接口，再把 `project.json` 中的
`supports_edits` 改为 `true`。

## 批量生成

```bash
# 每次最多调用 12 次 API，便于控制成本和观察漂移
.venv/bin/cardpipe --project project.json run --limit 12

# 确认批次后继续；已批准的牌不会重复生成
.venv/bin/cardpipe --project project.json run --limit 12
```

`workflow.max_attempts` 控制每张牌自动返工上限。超过上限会进入
`needs_human`，不会无限消耗额度。`workflow.concurrency` 控制并发数。

## 视觉 QA Agent

如服务还提供 OpenAI-compatible 的视觉聊天模型，可在 `.env` 中配置：

```dotenv
CARDPIPE_QA_MODEL=your-vision-model
```

视觉 Agent 会按 `art_bible.json > qa_rubric` 返回结构化审核：

- `passed`
- `score`
- `issues`
- `revision_instruction`

如果视觉接口不可用，系统会降级为确定性检查，并在审核记录中标明 fallback；
仍然要求人工批准，因此不会静默发布未审核资产。

## 审计和全局一致性检查

```bash
.venv/bin/cardpipe --project project.json audit
.venv/bin/cardpipe --project project.json contact-sheet
.venv/bin/cardpipe --project project.json render
```

默认输出在项目配置的 workspace 内：

- `audit.json`：每张牌完整生成履历，可复现和核算。
- `contact-sheet.jpg`：把最新版或批准版平铺，特别适合发现色彩、构图漂移。
- `pipeline.sqlite3`：状态机账本。
- `assets/<card-id>/vNN.png`：版本化原始插画。
- `rendered/<card-id>.jpg`：批准后的固定版式成品卡。

在样卡批准前需要预览卡框时，可运行：

```bash
.venv/bin/cardpipe --project project.json render --card spades_ace --latest
```

卡框参数位于 `project.json > layout`。正式项目建议在 `font_path` 指定一个包含所需
中文字符、且拥有商业使用授权的字体文件。

## 配置注意事项

服务请求默认发送到：

```text
POST <base_url>/v1/images/generations
```

系统接受响应中的 `data[0].b64_json` 或 `data[0].url`。常见的服务私有参数可放在
`project.json > provider.extra_body`。如果第三方实现不接受 `quality`、
`output_format` 或当前尺寸，应调整 `project.json`，适配器本身无需修改。

密钥只从环境变量或未跟踪的 `.env` 读取。根目录 `.gitignore` 已排除所有 `.env`、
工作空间、生成图片、数据库和虚拟环境。

## 测试

```bash
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/pytest
```
