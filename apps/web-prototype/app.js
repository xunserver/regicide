const suitMeta = {
  hearts: { label: '红桃', icon: '♥', tone: 'hearts' },
  diamonds: { label: '方块', icon: '♦', tone: 'diamonds' },
  clubs: { label: '梅花', icon: '♣', tone: 'clubs' },
  spades: { label: '黑桃', icon: '♠', tone: 'spades' },
}

const rankMeta = {
  jack: { label: '侍从', value: 10 },
  queen: { label: '王后', value: 15 },
  king: { label: '国王', value: 20 },
  'animal-companion': { label: '伙伴', value: 1 },
}

const enemyStats = {
  jack: { attack: 10, health: 20 },
  queen: { attack: 15, health: 30 },
  king: { attack: 20, health: 40 },
}

const variants = [
  { key: 'A', name: '战场中心' },
  { key: 'B', name: '战术台账' },
  { key: 'C', name: '手牌决策' },
]

let fixtures = []
let fixtureIndex = 0
let selected = []
let intent = null
let blockers = new Set()
let animationActive = false
let lastResult = '等待玩家意图'
let showOracle = false
let showRules = false

const app = document.querySelector('#app')
const isPrototypeHost = ['localhost', '127.0.0.1'].includes(location.hostname)
const mobileSimulation = new URLSearchParams(location.search).get('viewport') === 'mobile'
document.documentElement.classList.toggle('mobile-sim', mobileSimulation)

function currentFixture() {
  return fixtures[fixtureIndex]
}

function currentVariant() {
  const key = new URLSearchParams(location.search).get('variant')?.toUpperCase() ?? 'A'
  return variants.find((variant) => variant.key === key) ?? variants[0]
}

function cardInfo(cardId) {
  if (cardId.startsWith('jester-'))
    return { id: cardId, rank: '小丑', value: 0, icon: '✦', tone: 'jester' }
  const separator = cardId.indexOf('-')
  const suit = cardId.slice(0, separator)
  const rawRank = cardId.slice(separator + 1)
  const numeric = Number(rawRank)
  const rank = Number.isNaN(numeric)
    ? rankMeta[rawRank]
    : { label: String(numeric), value: numeric }
  const suitData = suitMeta[suit]
  return {
    id: cardId,
    rank: rank.label,
    value: rank.value,
    icon: suitData.icon,
    tone: suitData.tone,
    suit: suitData.label,
  }
}

function cardValue(cardId) {
  return cardInfo(cardId).value
}

function enemyInfo() {
  const fixture = currentFixture()
  const [, rank] = fixture.enemy.split('-')
  const base = enemyStats[rank] ?? enemyStats.jack
  const playedDamage = fixture.plays.reduce((total, play) => {
    const attack = play.cardIds.reduce((sum, cardId) => sum + cardValue(cardId), 0)
    const clubsActive =
      play.cardIds.some((cardId) => cardId.startsWith('clubs-')) &&
      !fixture.enemy.startsWith('clubs-')
    return total + attack * (clubsActive ? 2 : 1)
  }, 0)
  const shield = fixture.plays.reduce((total, play) => {
    const spadesActive =
      play.cardIds.some((cardId) => cardId.startsWith('spades-')) &&
      !fixture.enemy.startsWith('spades-')
    return spadesActive
      ? total + play.cardIds.reduce((sum, cardId) => sum + cardValue(cardId), 0)
      : total
  }, 0)
  return {
    rank,
    label: rankMeta[rank]?.label ?? rank,
    suit: suitMeta[fixture.enemy.split('-')[0]]?.label ?? '未知',
    icon: suitMeta[fixture.enemy.split('-')[0]]?.icon ?? '◆',
    attack: base.attack,
    health: base.health,
    damage: playedDamage,
    healthRemaining: Math.max(0, base.health - playedDamage),
    shield,
    counterattack: Math.max(0, base.attack - shield),
  }
}

function publicState() {
  const fixture = currentFixture()
  const handValue = fixture.hand.reduce((sum, cardId) => sum + cardValue(cardId), 0)
  return {
    status: 'in-progress',
    pendingDecision: fixture.pendingDecision,
    enemy: fixture.enemy,
    enemyHealth: enemyInfo().healthRemaining,
    enemyAttack: enemyInfo().attack,
    enemyShield: enemyInfo().shield,
    counterattack: enemyInfo().counterattack,
    hand: fixture.hand,
    handValue,
    castleCount: fixture.castleDeck.length,
    tavernCount: fixture.tavernDeck.length,
    discardCount: fixture.discardPile.length,
    soloJesters: fixture.soloAvailable.length,
    selected,
    blockers: [...blockers],
    animation: animationActive,
  }
}

function selectedValue() {
  return selected.reduce((sum, cardId) => sum + cardValue(cardId), 0)
}

function selectionIsLegal() {
  const fixture = currentFixture()
  if (fixture.pendingDecision === 'discard-for-damage')
    return selected.length > 0 && selectedValue() >= enemyInfo().counterattack
  if (selected.length === 0) return false
  if (selected.length === 1) return true
  const cards = selected.map(cardInfo)
  if (cards.some((card) => card.tone === 'jester')) return false
  if (cards.length === 2 && cards.some((card) => card.rank === '伙伴')) return true
  return (
    cards.length >= 2 &&
    cards.length <= 4 &&
    cards.every((card) => /^\d+$/.test(card.rank)) &&
    new Set(cards.map((card) => card.rank)).size === 1 &&
    selectedValue() <= 10
  )
}

function preview() {
  const fixture = currentFixture()
  if (intent === 'yield') {
    return {
      label: '让牌',
      detail: `反击 ${enemyInfo().counterattack} 点；手牌总点数 ${publicState().handValue}；${publicState().handValue < enemyInfo().counterattack ? '结果确定为失败' : '进入承伤弃牌'}`,
      resolution: 'known',
    }
  }
  if (intent === 'jester') {
    return {
      label: 'Solo Jester',
      detail: `弃掉 ${fixture.hand.length} 张，抽取最多 ${Math.min(8, fixture.tavernDeck.length)} 张；剩余 ${Math.max(0, fixture.soloAvailable.length - 1)} 次`,
      resolution: fixture.tavernDeck.length ? 'hidden-dependent' : 'known',
    }
  }
  if (!selectionIsLegal()) return null
  const attack =
    selectedValue() *
    (selected.some((cardId) => cardId.startsWith('clubs-')) && !fixture.enemy.startsWith('clubs-')
      ? 2
      : 1)
  return {
    label: fixture.pendingDecision === 'discard-for-damage' ? '承伤弃牌' : '出牌',
    detail:
      fixture.pendingDecision === 'discard-for-damage'
        ? `需要 ${enemyInfo().counterattack}，已选 ${selectedValue()}，超出 ${Math.max(0, selectedValue() - enemyInfo().counterattack)}`
        : `攻击 ${attack}；敌人 ${Math.max(0, enemyInfo().healthRemaining - attack)}/${enemyInfo().health}；反击 ${enemyInfo().counterattack}`,
    resolution: 'known',
  }
}

function capabilities() {
  const blocked = blockers.size > 0
  return {
    canSelectCards: !blocked && currentFixture().pendingDecision !== null,
    canSubmitIntent: !blocked && (intent === 'yield' || intent === 'jester' || selectionIsLegal()),
    canFastForward: animationActive,
  }
}

function suitBadge(card) {
  return `<span class="suit-mark ${card.tone}" aria-label="${card.suit ?? card.rank}">${card.icon}</span>`
}

function cardButton(cardId, large = false) {
  const card = cardInfo(cardId)
  const isSelected = selected.includes(cardId)
  return `<button class="card ${card.tone} ${isSelected ? 'selected' : ''} ${large ? 'large' : ''}" data-card="${cardId}" aria-pressed="${isSelected}" aria-label="${card.suit ?? ''} ${card.rank}，${card.value} 点">
    <span class="card-rank">${card.rank}</span>${suitBadge(card)}<span class="card-value">${card.value}</span>
  </button>`
}

function blockerControls() {
  const labels = {
    session: '会话失效',
    background: '后台',
    modal: '弹窗',
    renderer: '渲染器',
    orientation: '横屏',
    viewport: '视口',
  }
  const symbols = {
    session: '!',
    background: '◐',
    modal: '□',
    renderer: '◇',
    orientation: '↻',
    viewport: '⌗',
  }
  return `<div class="blocker-controls" aria-label="原型阻断场景">
    ${Object.entries(labels)
      .map(
        ([key, label]) =>
          `<button class="icon-button ${blockers.has(key) ? 'active' : ''}" data-blocker="${key}" title="切换${label}阻断">${symbols[key]}</button>`,
      )
      .join('')}
    <button class="icon-button ${showOracle ? 'active' : ''}" data-oracle title="显示暗牌 oracle">◉</button>
    <button class="icon-button" data-rules title="打开规则参考">ⓘ</button>
  </div>`
}

function handStrip(large = false) {
  return `<div class="hand-strip" role="group" aria-label="手牌">
    ${currentFixture()
      .hand.map((cardId) => cardButton(cardId, large))
      .join('')}
  </div>`
}

function actionBar() {
  const caps = capabilities()
  const currentPreview = preview()
  return `<div class="action-bar">
    <div class="preview-line"><span class="eyebrow">当前预览</span><strong>${currentPreview?.label ?? '未选择'}</strong><span>${currentPreview?.detail ?? '从手牌或快捷意图开始'}</span><em>${currentPreview?.resolution ?? '—'}</em></div>
    <div class="action-buttons">
      <button class="command secondary" data-intent="yield" ${caps.canSelectCards ? '' : 'disabled'}>↷ 让牌</button>
      <button class="command secondary" data-intent="jester" ${caps.canSelectCards ? '' : 'disabled'}>✦ Solo Jester</button>
      <button class="command primary" data-commit ${caps.canSubmitIntent ? '' : 'disabled'}>▶ 提交意图</button>
      <button class="command fast-forward" data-fast-forward ${caps.canFastForward ? '' : 'disabled'}>» 快进动画</button>
    </div>
  </div>`
}

function fixtureRail() {
  return `<nav class="fixture-rail" aria-label="固定测试局面">
    ${fixtures.map((fixture, index) => `<button data-fixture="${index}" class="${index === fixtureIndex ? 'active' : ''}"><span>${String(index + 1).padStart(2, '0')}</span>${fixture.name}</button>`).join('')}
  </nav>`
}

function inspector() {
  const state = publicState()
  return `<section class="inspector" aria-label="原型状态检查">
    <div class="inspector-heading"><span class="eyebrow">PROTOTYPE STATE</span><span class="mono">memory only</span></div>
    <pre>${JSON.stringify(state, null, 2)}</pre>
    ${showOracle && currentFixture().alternateTavernDeck ? `<div class="oracle-note"><strong>oracle</strong><br />公开投影一致，顶牌只在提交结果中才显现：10 点可继续，2 点会失败。</div>` : ''}
  </section>`
}

function enemyHero(compact = false) {
  const enemy = enemyInfo()
  return `<section class="enemy-hero ${compact ? 'compact' : ''}">
    <div class="enemy-card">
      <span class="enemy-kicker">CURRENT ENEMY · ${enemy.suit}</span>
      <div class="enemy-title"><span class="enemy-rank">${enemy.label}</span><span class="enemy-suit">${enemy.icon}</span></div>
      <div class="enemy-meter"><span style="width:${Math.max(4, (enemy.healthRemaining / enemy.health) * 100)}%"></span></div>
      <div class="enemy-numbers"><strong>${enemy.healthRemaining}/${enemy.health}</strong><span>生命</span><strong>${enemy.attack}</strong><span>攻击</span><strong>${enemy.shield}</strong><span>护盾</span></div>
    </div>
    <div class="enemy-note"><span>反击</span><strong>${enemy.counterattack}</strong><span>点</span><span class="immunity">${enemy.suit} 免疫</span></div>
  </section>`
}

function publicHud() {
  const state = publicState()
  return `<div class="public-hud">
    <div><span>城堡</span><strong>${state.castleCount}</strong></div>
    <div><span>酒馆</span><strong>${state.tavernCount}</strong></div>
    <div><span>弃牌</span><strong>${state.discardCount}</strong></div>
    <div><span>Jester</span><strong>${state.soloJesters}</strong></div>
  </div>`
}

function variantA() {
  return `<div class="variant variant-a">
    <header class="topbar"><div><span class="eyebrow">REGICIDE / PROTOTYPE</span><h1>战场中心</h1></div><div class="top-actions">${blockerControls()}</div></header>
    ${fixtureRail()}
    <section class="arena-band">${enemyHero()}<div class="play-lane"><span class="eyebrow">COMMITTED LANE</span><div class="lane-cards">${
      currentFixture().plays.length
        ? currentFixture()
            .plays.flatMap((play) => play.cardIds)
            .map((cardId) => cardButton(cardId))
            .join('')
        : '<span class="empty-lane">等待一次已提交的牌面</span>'
    }</div></div>${publicHud()}</section>
    <section class="decision-band"><div class="section-heading"><span><span class="eyebrow">DECISION</span><strong>${currentFixture().pendingDecision === 'discard-for-damage' ? '选择承伤弃牌' : '选择一组牌'}</strong></span><span class="decision-value">${currentFixture().pendingDecision === 'discard-for-damage' ? `需 ${enemyInfo().counterattack} 点` : `手牌 ${publicState().handValue} 点`}</span></div>${handStrip()}${actionBar()}</section>
    ${inspector()}
  </div>`
}

function variantB() {
  const state = publicState()
  return `<div class="variant variant-b">
    <header class="topbar"><div><span class="eyebrow">PROTOTYPE / TACTICAL VIEW</span><h1>战术台账</h1></div><div class="top-actions">${blockerControls()}</div></header>
    ${fixtureRail()}
    <div class="tactical-grid">
      <aside class="status-rail"><div class="rail-label">PHASE</div><strong>${currentFixture().pendingDecision === 'discard-for-damage' ? '承伤' : '行动'}</strong><div class="rail-rule"></div><div class="rail-label">BLOCKERS</div><div class="blocker-list">${state.blockers.length ? state.blockers.map((blocker) => `<span>${blocker}</span>`).join('') : '<span class="quiet">none</span>'}</div><div class="rail-rule"></div><div class="rail-label">CAPABILITY</div><div class="capability-list"><span>选牌 <b>${capabilities().canSelectCards ? 'ON' : 'OFF'}</b></span><span>提交 <b>${capabilities().canSubmitIntent ? 'ON' : 'OFF'}</b></span><span>快进 <b>${capabilities().canFastForward ? 'ON' : 'OFF'}</b></span></div></aside>
      <main class="tactical-main">${enemyHero(true)}<section class="preview-table"><div class="section-heading"><span class="eyebrow">INTENT PREVIEW</span><span class="mono">public only</span></div><div class="preview-grid"><div><span>选择</span><strong>${selected.length ? selected.map((cardId) => cardInfo(cardId).rank).join(' + ') : '—'}</strong></div><div><span>攻击 / 承伤</span><strong>${intent === 'yield' ? enemyInfo().counterattack : selectedValue()}</strong></div><div><span>敌方余量</span><strong>${Math.max(0, enemyInfo().healthRemaining - selectedValue())}/${enemyInfo().health}</strong></div><div><span>结果边界</span><strong>${preview()?.resolution ?? '—'}</strong></div></div></section><section class="hand-ledger"><div class="section-heading"><span class="eyebrow">HAND / ORDERED</span><span>${state.hand.length} cards</span></div>${handStrip()}<div class="ledger-foot">选择不改变牌序 · 加入必须仍属于合法意图子集</div></section>${actionBar()}</main>
      <aside class="event-rail"><div class="rail-label">LAST RESULT</div><strong>${lastResult}</strong><div class="rail-rule"></div><div class="rail-label">ZONES</div>${publicHud()}<div class="rail-rule"></div><div class="rail-label">SCENARIO</div><p>${currentFixture().question}</p></aside>
    </div>
    ${inspector()}
  </div>`
}

function variantC() {
  return `<div class="variant variant-c">
    <header class="topbar"><div><span class="eyebrow">PROTOTYPE / DECISION SURFACE</span><h1>手牌决策</h1></div><div class="top-actions">${blockerControls()}</div></header>
    ${fixtureRail()}
    <section class="compact-banner"><div><span class="eyebrow">${currentFixture().pendingDecision === 'discard-for-damage' ? 'COUNTERATTACK' : 'YOUR TURN'}</span><strong>${currentFixture().pendingDecision === 'discard-for-damage' ? `弃牌点数至少 ${enemyInfo().counterattack}` : '先选牌，再确认意图'}</strong></div><div class="banner-stat"><span>敌人</span><strong>${enemyInfo().healthRemaining}/${enemyInfo().health}</strong></div><div class="banner-stat"><span>反击</span><strong>${enemyInfo().counterattack}</strong></div></section>
    <section class="hand-first">${handStrip(true)}<div class="selection-summary"><span class="eyebrow">SELECTION</span><strong>${selected.length ? selected.map((cardId) => cardInfo(cardId).rank).join(' · ') : '尚未选择'}</strong><span>${selected.length ? `${selectedValue()} 点` : '点击卡牌查看公开后果'}</span></div></section>
    <section class="enemy-drawer">${enemyHero(true)}<div class="drawer-detail"><span class="eyebrow">PUBLIC TABLE</span><div class="drawer-stats"><span>城堡 <b>${publicState().castleCount}</b></span><span>酒馆 <b>${publicState().tavernCount}</b></span><span>弃牌 <b>${publicState().discardCount}</b></span><span>Jester <b>${publicState().soloJesters}</b></span></div></div></section>
    <section class="command-sheet"><div class="sheet-preview"><span class="eyebrow">NEXT EFFECT</span><strong>${preview()?.label ?? '等待选择'}</strong><p>${preview()?.detail ?? '公开信息会随当前选择更新'}</p><span class="resolution-tag">${preview()?.resolution ?? 'PUBLIC'}</span></div>${actionBar()}</section>
    ${inspector()}
  </div>`
}

function prototypeSwitcher() {
  if (!isPrototypeHost) return ''
  const variant = currentVariant()
  return `<nav class="prototype-switcher" aria-label="Prototype variants">
    <button type="button" data-viewport-toggle aria-label="切换移动视口" title="切换移动视口">${document.documentElement.classList.contains('mobile-sim') ? '▣' : '▯'}</button>
    <button type="button" data-prev aria-label="上一个变体" title="上一个变体">←</button>
    <span class="switch-label">${variant.key} · ${variant.name}${document.documentElement.classList.contains('mobile-sim') ? ' · 360px' : ''}</span>
    <button type="button" data-next aria-label="下一个变体" title="下一个变体">→</button>
  </nav>`
}

function render() {
  const variant = currentVariant()
  app.innerHTML = `${variant.key === 'A' ? variantA() : variant.key === 'B' ? variantB() : variantC()}${prototypeSwitcher()}${rulesDialog()}`
  bind()
}

function setVariant(key) {
  const url = new URL(location.href)
  url.searchParams.set('variant', key)
  history.replaceState(null, '', url)
  render()
}

function toggleViewportMode() {
  const url = new URL(location.href)
  const mobile = !document.documentElement.classList.contains('mobile-sim')
  if (mobile) url.searchParams.set('viewport', 'mobile')
  else url.searchParams.delete('viewport')
  history.replaceState(null, '', url)
  document.documentElement.classList.toggle('mobile-sim', mobile)
  render()
}

function bind() {
  app.querySelectorAll('[data-card]').forEach((button) =>
    button.addEventListener('click', () => {
      if (!capabilities().canSelectCards) return
      const cardId = button.dataset.card
      selected = selected.includes(cardId)
        ? selected.filter((id) => id !== cardId)
        : [...selected, cardId]
      intent = null
      lastResult = '选择已更新'
      render()
    }),
  )
  app.querySelectorAll('[data-intent]').forEach((button) =>
    button.addEventListener('click', () => {
      if (!capabilities().canSelectCards) return
      intent = button.dataset.intent
      selected = []
      lastResult = intent === 'yield' ? '已准备让牌预览' : '已准备 Solo Jester 预览'
      render()
    }),
  )
  app.querySelector('[data-commit]')?.addEventListener('click', () => commit())
  app.querySelector('[data-fast-forward]')?.addEventListener('click', () => {
    if (!animationActive) return
    animationActive = false
    blockers.delete('animation')
    lastResult = '动画已快进到提交后快照'
    render()
  })
  app.querySelectorAll('[data-blocker]').forEach((button) =>
    button.addEventListener('click', () => {
      const key = button.dataset.blocker
      if (blockers.has(key)) blockers.delete(key)
      else blockers.add(key)
      if (key === 'background' && blockers.has(key)) {
        animationActive = false
        blockers.delete('animation')
      }
      if (key === 'session' && blockers.has(key)) {
        selected = []
        intent = null
        animationActive = false
        blockers.delete('animation')
      }
      lastResult = `已切换 ${key} blocker`
      render()
    }),
  )
  app.querySelector('[data-oracle]')?.addEventListener('click', () => {
    showOracle = !showOracle
    render()
  })
  app.querySelector('[data-rules]')?.addEventListener('click', () => {
    showRules = true
    blockers.add('modal')
    render()
  })
  app.querySelectorAll('[data-fixture]').forEach((button) =>
    button.addEventListener('click', () => {
      fixtureIndex = Number(button.dataset.fixture)
      selected = []
      intent = null
      blockers = new Set()
      animationActive = false
      lastResult = '已切换固定局面'
      render()
    }),
  )
  app.querySelector('[data-prev]')?.addEventListener('click', () => cycleVariant(-1))
  app.querySelector('[data-next]')?.addEventListener('click', () => cycleVariant(1))
  app.querySelector('[data-viewport-toggle]')?.addEventListener('click', toggleViewportMode)
  app.querySelector('[data-close-rules]')?.addEventListener('click', () => {
    showRules = false
    blockers.delete('modal')
    render()
  })
}

function cycleVariant(direction) {
  const current = variants.findIndex((variant) => variant.key === currentVariant().key)
  const next = (current + direction + variants.length) % variants.length
  setVariant(variants[next].key)
}

function commit() {
  const caps = capabilities()
  if (!caps.canSubmitIntent) {
    lastResult = blockers.size ? '提交被 blocker 拦截' : '还没有完整合法意图'
    render()
    return
  }
  if (currentFixture().commitMode === 'storage-error') {
    lastResult = '模拟存档失败：选择保留，可关闭错误后重试'
    render()
    return
  }
  lastResult = '已保存并提交，事件动画播放中'
  selected = []
  intent = null
  animationActive = true
  blockers.add('animation')
  render()
}

function rulesDialog() {
  if (!showRules) return ''
  return `<div class="modal-backdrop"><section class="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="rules-title"><div class="dialog-head"><span class="eyebrow">REFERENCE</span><button class="icon-button" data-close-rules aria-label="关闭规则参考">×</button></div><h2 id="rules-title">规则参考</h2><dl><dt>出牌</dt><dd>单牌，或同点数的合法组合；梅花加倍攻击。</dd><dt>反击</dt><dd>让牌或出牌后，按公开反击点数选择承伤弃牌。</dd><dt>Solo Jester</dt><dd>弃掉整手牌并重新抽牌；酒馆顶牌身份不在预览中公开。</dd><dt>免疫</dt><dd>敌人同花色会抵消该花色效果，Jester 可取消免疫。</dd></dl></section></div>`
}

document.addEventListener('keydown', (event) => {
  if (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) ||
    document.activeElement?.isContentEditable
  )
    return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    cycleVariant(-1)
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    cycleVariant(1)
  }
})

fetch('/prototypes/active-table-fixtures.json')
  .then((response) => response.json())
  .then((data) => {
    fixtures = data
    render()
  })
