import { describe, expect, it } from 'vitest'
import { createRandomState, shuffle } from '../src/random'

describe('deterministic random state', () => {
  it('reproduces seeds and distinguishes different seeds', () => {
    expect(createRandomState('same')).toEqual(createRandomState('same'))
    expect(createRandomState('same')).not.toEqual(createRandomState('different'))
    expect(createRandomState(42)).toEqual(createRandomState(42))
    expect(createRandomState(42).state).toBeGreaterThan(0)
  })

  it('shuffles deterministically without changing its inputs', () => {
    const items = [1, 2, 3, 4, 5]
    const random = createRandomState('shuffle')
    const [first, firstRandom] = shuffle(items, random)
    const [second, secondRandom] = shuffle(items, random)

    expect(first).toEqual(second)
    expect(firstRandom).toEqual(secondRandom)
    expect([...first].sort()).toEqual(items)
    expect(firstRandom).not.toEqual(random)
    expect(items).toEqual([1, 2, 3, 4, 5])
  })

  it('handles empty and single-item collections without advancing randomness', () => {
    const random = createRandomState('small')
    expect(shuffle([], random)).toEqual([[], random])
    expect(shuffle(['only'], random)).toEqual([['only'], random])
  })
})
