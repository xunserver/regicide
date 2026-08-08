import { describe, expect, it } from 'vitest'
import { validatePlay } from '../index.ts'
import { card } from './helpers.ts'

describe('validatePlay', () => {
  it('allows a single card', () => {
    const result = validatePlay([card('H', '7')])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.attackValue).toBe(7)
      expect(result.plan.suits).toEqual(['H'])
    }
  })

  it('allows Ace paired with another card and merges suits', () => {
    const result = validatePlay([card('C', 'A'), card('D', '8')])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.attackValue).toBe(9)
      expect(result.plan.suits).toEqual(['C', 'D'])
    }
  })

  it('applies same-suit Ace pair only once', () => {
    const result = validatePlay([card('H', 'A'), card('H', '5')])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.suits).toEqual(['H'])
      expect(result.plan.attackValue).toBe(6)
    }
  })

  it('allows Ace + Ace', () => {
    const result = validatePlay([card('H', 'A'), card('S', 'A')])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.attackValue).toBe(2)
  })

  it('rejects Ace with more than one partner', () => {
    const result = validatePlay([card('H', 'A'), card('D', '2'), card('C', '3')])
    expect(result.ok).toBe(false)
  })

  it('allows legal combos', () => {
    expect(validatePlay([card('H', '2'), card('D', '2')]).ok).toBe(true)
    expect(validatePlay([card('H', '3'), card('D', '3'), card('C', '3')]).ok).toBe(true)
    expect(
      validatePlay([card('H', '2'), card('D', '2'), card('C', '2'), card('S', '2')]).ok,
    ).toBe(true)
  })

  it('rejects illegal combos', () => {
    expect(validatePlay([card('H', '6'), card('D', '6')]).ok).toBe(false)
    expect(validatePlay([card('H', '5'), card('D', '5'), card('C', '5')]).ok).toBe(false) // 15 > 10
    expect(validatePlay([card('H', '2'), card('D', '3')]).ok).toBe(false)
  })
})
