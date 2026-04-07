/**
 * TranslationOrchestrator — coordinates translation of visible lines.
 *
 * - Translates lines in batches (consecutive lines grouped together)
 * - Handles scroll: if user scrolls while translating, queues new range
 * - Uses cache to avoid re-translating
 * - All dependencies injected for testability
 */

import { TranslationCache } from './cache'
import { buildSkipLines, isTranslatable } from './filter'

export interface OrchestratorDeps {
  getLineText(lineNum: number): string;
  getLineCount(): number;
  translateBatch(texts: string[]): Promise<string[]>;
  onUpdate(decorations: Map<number, string>, loading: Set<number>): void;
  cache: TranslationCache;
  provider: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export const BATCH_SIZE = 5

/** Group consecutive numbers, then split into chunks of maxSize */
export function groupConsecutive(nums: number[], maxSize: number = BATCH_SIZE): number[][] {
  if (nums.length === 0) { return [] }

  const groups: number[][] = []
  let current: number[] = [nums[0]]

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) {
      current.push(nums[i])
    } else {
      groups.push(current)
      current = [nums[i]]
    }
  }
  groups.push(current)

  return groups.flatMap(group =>
    Array.from({ length: Math.ceil(group.length / maxSize) }, (_, i) =>
      group.slice(i * maxSize, (i + 1) * maxSize),
    ),
  )
}

export class TranslationOrchestrator {
  /** Lines that have been processed (translated or skipped) */
  private done = new Set<number>()
  /** Lines currently loading */
  private loading = new Set<number>()
  /** Line number -> translated text */
  private decorations = new Map<number, string>()
  /** Skip lines cache per document version */
  private skipLines: Set<number> | null = null

  private running = false
  private pending: { start: number; end: number } | null = null

  constructor(private deps: OrchestratorDeps) {}

  /** Request translation of lines [start, end). Queues if already running. */
  async translateRange(start: number, end: number): Promise<void> {
    if (this.running) {
      this.pending = { start, end }
      return
    }

    this.running = true
    try {
      let [s, e] = [start, end]
      while (true) {
        await this.processRange(s, e)
        if (!this.pending) { break }
        [s, e] = [this.pending.start, this.pending.end]
        this.pending = null
      }
    } finally {
      this.running = false
    }
  }

  reapply(): void {
    this.notify()
  }

  reset(): void {
    this.pending = null
    this.running = false
    this.done.clear()
    this.loading.clear()
    this.decorations.clear()
    this.skipLines = null
  }

  invalidateSkipLines(): void {
    this.skipLines = null
  }

  private getSkipLines(): Set<number> {
    this.skipLines ??= buildSkipLines(
      Array.from({ length: this.deps.getLineCount() }, (_, i) => this.deps.getLineText(i)),
    )
    return this.skipLines
  }

  private shouldTranslate(lineNum: number): boolean {
    if (this.getSkipLines().has(lineNum)) { return false }
    const text = this.deps.getLineText(lineNum)
    return isTranslatable(text)
  }

  private async processRange(start: number, end: number): Promise<void> {
    const toTranslate: number[] = []
    for (let i = start; i < end; i++) {
      if (!this.done.has(i) && this.shouldTranslate(i)) {
        toTranslate.push(i)
      } else {
        this.done.add(i)
      }
    }

    if (toTranslate.length === 0) {
      console.log(`[orch] processRange(${start}, ${end}): nothing to translate`)
      return
    }

    console.log(`[orch] processRange(${start}, ${end}): ${toTranslate.length} lines to translate`)

    // Show loading state
    for (const ln of toTranslate) { this.loading.add(ln) }
    this.notify()

    const batches = groupConsecutive(toTranslate)

    for (const batch of batches) {
      // Yield to new viewport if user scrolled
      if (this.pending) {
        console.log(`[orch] pending detected, yielding. done=${this.done.size} decorations=${this.decorations.size}`)
        this.clearLoading(toTranslate)
        return
      }

      await this.translateBatch(batch)
    }

    this.clearLoading(toTranslate)
  }

  private async translateBatch(lineNums: number[]): Promise<void> {
    const { cache, provider, sourceLanguage: src, targetLanguage: tgt } = this.deps

    const entries = lineNums.map(ln => {
      const text = this.deps.getLineText(ln).trim()
      const key = cache.buildKey(text, provider, src, tgt)
      return { ln, text, key, cached: cache.get(key) }
    })

    // Apply cached results immediately
    const uncached = entries.filter(e => {
      if (e.cached) {
        this.decorations.set(e.ln, e.cached)
        this.done.add(e.ln)
        this.loading.delete(e.ln)
        return false
      }
      return true
    })

    console.log(`[orch] batch lines [${lineNums.join(',')}]: ${entries.length - uncached.length} cached, ${uncached.length} to translate`)

    if (uncached.length > 0) {
      const results = await this.deps.translateBatch(uncached.map(e => e.text))
        .catch((err) => { console.log(`[orch] translateBatch error:`, err); return uncached.map(() => '') })

      console.log(`[orch] batch results: [${results.map(r => r.slice(0, 20)).join(', ')}]`)

      uncached.forEach((e, i) => {
        const translated = results[i] ?? ''
        if (translated) {
          cache.set(e.key, translated)
          this.decorations.set(e.ln, translated)
        }
        this.done.add(e.ln)
        this.loading.delete(e.ln)
      })
    }

    console.log(`[orch] notify: decorations=${this.decorations.size} loading=${this.loading.size}`)
    this.notify()
  }

  private clearLoading(lines: number[]): void {
    if (lines.some(ln => this.loading.delete(ln))) { this.notify() }
  }

  private notify(): void {
    this.deps.onUpdate(this.decorations, this.loading)
  }
}
