import type {
  GameSaveStore,
  ReadonlyGameState,
  SaveClearResult,
  SaveLoadResult,
  SaveWriteResult,
} from '../../src'

interface FakeGameSaveStoreOptions {
  readonly loadResults?: readonly SaveLoadResult[]
  readonly saveResults?: readonly SaveWriteResult[]
  readonly clearResults?: readonly SaveClearResult[]
}

export class FakeGameSaveStore implements GameSaveStore {
  public readonly calls: string[] = []
  public readonly savedGames: ReadonlyGameState[] = []
  public loadCalls = 0
  public saveCalls = 0
  public clearCalls = 0
  public subscribeCalls = 0
  public unsubscribeCalls = 0
  public throwOnNextLoad = false
  public throwOnUnsubscribe = false
  public onSave: ((game: ReadonlyGameState) => void) | undefined

  private readonly loadResults: SaveLoadResult[]
  private readonly saveResults: SaveWriteResult[]
  private readonly clearResults: SaveClearResult[]
  private readonly externalChangeListeners = new Set<() => void>()

  public constructor(options: FakeGameSaveStoreOptions = {}) {
    this.loadResults = [...(options.loadResults ?? [])]
    this.saveResults = [...(options.saveResults ?? [])]
    this.clearResults = [...(options.clearResults ?? [])]
  }

  public load(): SaveLoadResult {
    this.calls.push('load')
    this.loadCalls += 1
    if (this.throwOnNextLoad) {
      this.throwOnNextLoad = false
      throw new Error('unexpected load failure')
    }
    return this.loadResults.shift() ?? { status: 'empty' }
  }

  public save(game: ReadonlyGameState): SaveWriteResult {
    this.calls.push('save')
    this.saveCalls += 1
    this.savedGames.push(game)
    this.onSave?.(game)
    return this.saveResults.shift() ?? { status: 'saved' }
  }

  public clear(): SaveClearResult {
    this.calls.push('clear')
    this.clearCalls += 1
    return this.clearResults.shift() ?? { status: 'cleared' }
  }

  public onExternalChange(listener: () => void): () => void {
    this.calls.push('subscribe')
    this.subscribeCalls += 1
    this.externalChangeListeners.add(listener)
    let subscribed = true

    return () => {
      if (!subscribed) return
      subscribed = false
      this.externalChangeListeners.delete(listener)
      this.unsubscribeCalls += 1
      if (this.throwOnUnsubscribe) throw new Error('unsubscribe failed')
    }
  }

  public emitExternalChange(): void {
    for (const listener of [...this.externalChangeListeners]) listener()
  }

  public get activeExternalListeners(): number {
    return this.externalChangeListeners.size
  }
}
