import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TranslationCache, CacheStorage } from '../cache'

function createMockStorage(): CacheStorage & { data: Record<string, string> | undefined } {
  const mock = {
    data: undefined as Record<string, string> | undefined,
    get: () => mock.data,
    set: (d: Record<string, string>) => { mock.data = d },
  }
  return mock
}

describe('TranslationCache', () => {
  it('builds cache key from components', () => {
    const cache = new TranslationCache()
    const key = cache.buildKey('hello', 'google-translate', 'en', 'zh-CN')
    assert.equal(key, 'google-translate:en:zh-CN:hello')
  })

  it('stores and retrieves values', () => {
    const cache = new TranslationCache()
    cache.set('k1', 'v1')
    assert.equal(cache.get('k1'), 'v1')
    assert.equal(cache.get('k2'), undefined)
  })

  it('reports size', () => {
    const cache = new TranslationCache()
    assert.equal(cache.size, 0)
    cache.set('k1', 'v1')
    assert.equal(cache.size, 1)
  })

  it('clears all entries and storage', () => {
    const storage = createMockStorage()
    const cache = new TranslationCache(storage)
    cache.set('k1', 'v1')
    cache.clear()
    assert.equal(cache.size, 0)
    assert.deepStrictEqual(storage.data, {})
  })

  it('persists to storage', () => {
    const storage = createMockStorage()
    const cache = new TranslationCache(storage)
    cache.set('k1', 'v1')
    cache.persist()
    assert.deepStrictEqual(storage.data, { k1: 'v1' })
  })

  it('loads from storage on construction', () => {
    const storage = createMockStorage()
    storage.data = { k1: 'v1', k2: 'v2' }
    const cache = new TranslationCache(storage)
    assert.equal(cache.get('k1'), 'v1')
    assert.equal(cache.get('k2'), 'v2')
    assert.equal(cache.size, 2)
  })

  it('works without storage (memory only)', () => {
    const cache = new TranslationCache()
    cache.set('k1', 'v1')
    cache.persist() // should not throw
    assert.equal(cache.get('k1'), 'v1')
  })
})
