/**
 * Translation cache — memory + persistent storage.
 * Storage interface is injected so this module doesn't depend on VSCode.
 */

const MAX_ENTRIES = 2000

export interface CacheStorage {
  get(): Record<string, string> | undefined;
  set(data: Record<string, string>): void;
}

export class TranslationCache {
  private map = new Map<string, string>()

  constructor(private storage?: CacheStorage) {
    this.load()
  }

  buildKey(text: string, provider: string, source: string, target: string): string {
    return `${provider}:${source}:${target}:${text}`
  }

  get(key: string): string | undefined {
    return this.map.get(key)
  }

  set(key: string, value: string): void {
    this.map.set(key, value)
  }

  get size(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
    this.storage?.set({})
  }

  persist(): void {
    if (!this.storage) { return }
    this.evict()
    this.storage.set(Object.fromEntries(this.map))
  }

  private load(): void {
    const stored = this.storage?.get()
    if (stored) {
      this.map = new Map(Object.entries(stored))
    }
  }

  private evict(): void {
    if (this.map.size <= MAX_ENTRIES) { return }
    [...this.map.keys()]
      .slice(0, this.map.size - MAX_ENTRIES)
      .forEach(key => this.map.delete(key))
  }
}
