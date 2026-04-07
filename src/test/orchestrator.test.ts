import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { groupConsecutive, TranslationOrchestrator, OrchestratorDeps } from '../orchestrator'
import { TranslationCache } from '../cache'

describe('groupConsecutive', () => {
  it('groups consecutive numbers', () => {
    assert.deepStrictEqual(groupConsecutive([1, 2, 3, 5, 6, 8]), [[1, 2, 3], [5, 6], [8]])
  })

  it('splits groups exceeding max size', () => {
    assert.deepStrictEqual(groupConsecutive([1, 2, 3, 4, 5, 6], 3), [[1, 2, 3], [4, 5, 6]])
  })

  it('returns empty for empty input', () => {
    assert.deepStrictEqual(groupConsecutive([]), [])
  })

  it('handles single element', () => {
    assert.deepStrictEqual(groupConsecutive([5]), [[5]])
  })
})

describe('TranslationOrchestrator', () => {
  function createMockDeps(lines: string[], overrides?: Partial<OrchestratorDeps>): OrchestratorDeps {
    return {
      getLineText: (ln) => lines[ln] ?? '',
      getLineCount: () => lines.length,
      translateBatch: async (texts) => texts.map(t => `[translated] ${t}`),
      onUpdate: () => {},
      cache: new TranslationCache(),
      provider: 'google-free',
      sourceLanguage: 'en',
      targetLanguage: 'zh-CN',
      ...overrides,
    }
  }

  it('translates visible lines', async () => {
    const lines = ['Hello world', 'This is a test', '---', 'Another line']
    const updates: Array<{ decorations: Map<number, string>; loading: Set<number> }> = []

    const deps = createMockDeps(lines, {
      onUpdate: (decorations, loading) => {
        updates.push({ decorations: new Map(decorations), loading: new Set(loading) })
      },
    })

    const orch = new TranslationOrchestrator(deps)
    await orch.translateRange(0, 4)

    const lastUpdate = updates[updates.length - 1]
    assert.equal(lastUpdate.decorations.has(0), true)
    assert.equal(lastUpdate.decorations.has(1), true)
    assert.equal(lastUpdate.decorations.has(2), false)
    assert.equal(lastUpdate.decorations.has(3), true)
    assert.equal(lastUpdate.loading.size, 0)
  })

  it('uses cache for already translated text', async () => {
    const lines = ['Hello world']
    let batchCount = 0

    const deps = createMockDeps(lines, {
      translateBatch: async (texts) => {
        batchCount++
        return texts.map(t => `[translated] ${t}`)
      },
    })

    const orch = new TranslationOrchestrator(deps)
    await orch.translateRange(0, 1)
    assert.equal(batchCount, 1)

    // Reset state but keep cache
    orch.reset()
    await orch.translateRange(0, 1)
    assert.equal(batchCount, 1)
  })

  it('skips code block lines', async () => {
    const lines = ['Hello', '```', 'code here', '```', 'World']
    const batches: string[][] = []

    const deps = createMockDeps(lines, {
      translateBatch: async (texts) => {
        batches.push([...texts])
        return texts.map(t => `[t] ${t}`)
      },
    })

    const orch = new TranslationOrchestrator(deps)
    await orch.translateRange(0, 5)

    const allTranslated = batches.flat()
    assert.deepStrictEqual(allTranslated, ['Hello', 'World'])
  })

  it('handles translate errors gracefully', async () => {
    const lines = ['Hello', 'World']

    const deps = createMockDeps(lines, {
      translateBatch: async () => { throw new Error('API error') },
    })

    const orch = new TranslationOrchestrator(deps)
    await orch.translateRange(0, 2)
  })

  it('sends batch with multiple lines in one call', async () => {
    const lines = ['Hello', 'World', 'Test']
    let callCount = 0

    const deps = createMockDeps(lines, {
      translateBatch: async (texts) => {
        callCount++
        return texts.map(t => `[t] ${t}`)
      },
    })

    const orch = new TranslationOrchestrator(deps)
    await orch.translateRange(0, 3)

    // All 3 consecutive lines should be in one batch (< BATCH_SIZE of 5)
    assert.equal(callCount, 1)
  })

  it('only sends uncached lines to translateBatch', async () => {
    const lines = ['Hello', 'World', 'Test']
    const cache = new TranslationCache()
    // Pre-populate cache for line 1 ("World")
    cache.set(cache.buildKey('World', 'google-free', 'en', 'zh-CN'), '世界')

    const batchedTexts: string[][] = []
    const deps = createMockDeps(lines, {
      cache,
      translateBatch: async (texts) => {
        batchedTexts.push([...texts])
        return texts.map(t => `[t] ${t}`)
      },
    })

    const orch = new TranslationOrchestrator(deps)
    await orch.translateRange(0, 3)

    // Only "Hello" and "Test" should be sent; "World" is cached
    assert.deepStrictEqual(batchedTexts.flat(), ['Hello', 'Test'])
  })

  it('preserves decorations across batches', async () => {
    const lines = ['Line A', 'Line B', '---', 'Line C', 'Line D']
    const updates: Array<{ decorations: Map<number, string> }> = []

    const deps = createMockDeps(lines, {
      onUpdate: (decorations) => {
        updates.push({ decorations: new Map(decorations) })
      },
    })

    const orch = new TranslationOrchestrator(deps)
    await orch.translateRange(0, 5)

    // Final update should have all translatable lines (0, 1, 3, 4)
    const last = updates[updates.length - 1]
    assert.equal(last.decorations.has(0), true)
    assert.equal(last.decorations.has(1), true)
    assert.equal(last.decorations.has(3), true)
    assert.equal(last.decorations.has(4), true)
    assert.equal(last.decorations.size, 4)
  })

  it('reapply triggers onUpdate with current decorations', async () => {
    const lines = ['Hello world', 'Another line']
    const updates: Array<{ decorations: Map<number, string>; loading: Set<number> }> = []

    const deps = createMockDeps(lines, {
      onUpdate: (decorations, loading) => {
        updates.push({ decorations: new Map(decorations), loading: new Set(loading) })
      },
    })

    const orch = new TranslationOrchestrator(deps)
    await orch.translateRange(0, 2)

    const beforeCount = updates.length
    orch.reapply()

    assert.equal(updates.length, beforeCount + 1)
    const last = updates[updates.length - 1]
    assert.equal(last.decorations.size, 2)
    assert.equal(last.loading.size, 0)
  })
})
