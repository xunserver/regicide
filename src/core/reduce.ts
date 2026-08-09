/**
 * 兼容入口：对外仍可从 `./reduce` 导入，实现已迁到显式状态机。
 *
 * - 状态机入口与图：`./machine.ts`
 * - 文档（含 Mermaid）：仓库 README「Core 状态机」
 */
export {
  applyAction,
  canFlipJester,
  canYield,
  cloneState,
  getDefendDamage,
  handLimit,
  isActionAllowed,
  PHASE_ACTIONS,
} from './machine.ts'

export type { Card } from './types.ts'
