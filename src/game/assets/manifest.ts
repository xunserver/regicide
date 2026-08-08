/** Logical mobile canvas - portrait H5. */
export const GAME_WIDTH = 390
export const GAME_HEIGHT = 844

/** Respect Vite `base` so assets resolve under `/regicide/` on GitHub Pages. */
export const ASSET_PATH = `${import.meta.env.BASE_URL}assets/regicide`.replace(/\/$/, '')

export const IMAGE_KEYS = {
  bgTable: 'bg_table',
  cardBack: 'card_back',
  cardFrame: 'card_frame',
  royalJack: 'royal_jack',
  royalQueen: 'royal_queen',
  royalKing: 'royal_king',
  jester: 'jester',
  uiPlaque: 'ui_plaque',
  uiButton: 'ui_button',
  suitH: 'suit_heart',
  suitD: 'suit_diamond',
  suitC: 'suit_club',
  suitS: 'suit_spade',
  aceH: 'ace_heart',
  aceD: 'ace_diamond',
  aceC: 'ace_club',
  aceS: 'ace_spade',
} as const

export type ImageKey = (typeof IMAGE_KEYS)[keyof typeof IMAGE_KEYS]

export const IMAGE_FILES: Record<ImageKey, string> = {
  bg_table: `${ASSET_PATH}/bg_table.png`,
  card_back: `${ASSET_PATH}/card_back.png`,
  card_frame: `${ASSET_PATH}/card_frame.png`,
  royal_jack: `${ASSET_PATH}/royal_jack.png`,
  royal_queen: `${ASSET_PATH}/royal_queen.png`,
  royal_king: `${ASSET_PATH}/royal_king.png`,
  jester: `${ASSET_PATH}/jester.png`,
  ui_plaque: `${ASSET_PATH}/ui_plaque.png`,
  ui_button: `${ASSET_PATH}/ui_button.png`,
  suit_heart: `${ASSET_PATH}/suit_heart.png`,
  suit_diamond: `${ASSET_PATH}/suit_diamond.png`,
  suit_club: `${ASSET_PATH}/suit_club.png`,
  suit_spade: `${ASSET_PATH}/suit_spade.png`,
  ace_heart: `${ASSET_PATH}/ace_heart.png`,
  ace_diamond: `${ASSET_PATH}/ace_diamond.png`,
  ace_club: `${ASSET_PATH}/ace_club.png`,
  ace_spade: `${ASSET_PATH}/ace_spade.png`,
}

export const SUIT_COLOR = {
  H: '#9b2c2c',
  D: '#9b2c2c',
  C: '#1c1c1c',
  S: '#1c1c1c',
} as const

export const THEME = {
  ink: '#1a1510',
  parchment: '#e8dcc4',
  gold: '#c9a227',
  crimson: '#8f1d1d',
  ash: '#2a2420',
  mist: '#d7cbb3',
} as const

export const CARD_W = 68
export const CARD_H = 96
/** Larger enemy portrait for mobile focus. */
export const ENEMY_CARD_W = 168
export const ENEMY_CARD_H = 236
