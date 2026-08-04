import type { GameSeedSource } from '../../src'

export class FixedGameSeedSource implements GameSeedSource {
  public calls = 0
  private index = 0

  public constructor(private readonly seeds: readonly (string | number)[] = ['test-seed']) {}

  public nextSeed(): string | number {
    const seed = this.seeds[this.index]
    if (seed === undefined) throw new Error('No fixed seed remains')
    this.index += 1
    this.calls += 1
    return seed
  }
}
