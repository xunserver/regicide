/**
 * 中文 UI 复测（修脚本收尾 bug）
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.REGICIDE_URL ?? 'http://localhost:5173/'
const OUT = path.resolve('qa-screenshots')
const GAME_W = 390
const GAME_H = 844

fs.mkdirSync(OUT, { recursive: true })

async function canvasBox(page) {
  const canvas = page.locator('canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 30000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('no canvas')
  return box
}

async function tapGame(page, gx, gy) {
  const box = await canvasBox(page)
  await page.touchscreen.tap(
    box.x + (gx / GAME_W) * box.width,
    box.y + (gy / GAME_H) * box.height,
  )
  await page.waitForTimeout(400)
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log('shot', file)
}

async function scenes(page) {
  return page.evaluate(() => {
    const g = window.__REGICIDE_GAME__
    return g ? g.scene.getScenes(true).map((s) => s.scene.key) : null
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
  ).newPage()

  page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  console.log('load', await scenes(page))
  await shot(page, 'final-01-menu')

  await tapGame(page, 195, Math.round(GAME_H * 0.72))
  await page.waitForTimeout(700)
  if (!(await scenes(page))?.includes('Table')) {
    await page.evaluate(() =>
      window.__REGICIDE_GAME__.scene.start('Table', { seed: 7 }),
    )
    await page.waitForTimeout(800)
  }
  console.log('table', await scenes(page))
  await shot(page, 'final-02-table')

  await tapGame(page, 95, 630)
  await shot(page, 'final-03-selected')
  await tapGame(page, Math.round(GAME_W * 0.18), GAME_H - 122)
  await page.waitForTimeout(700)
  await shot(page, 'final-04-after-play')

  await browser.close()
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
