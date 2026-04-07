import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildSkipLines, isTranslatable } from '../filter'

describe('buildSkipLines', () => {
  it('marks lines inside fenced code blocks', () => {
    const lines = [
      'Hello',
      '```',
      'const x = 1;',
      'const y = 2;',
      '```',
      'World',
    ]
    const skip = buildSkipLines(lines)
    assert.deepStrictEqual([...skip].sort(), [1, 2, 3, 4])
  })

  it('handles multiple code blocks', () => {
    const lines = [
      'text',
      '```js',
      'code1',
      '```',
      'text2',
      '```',
      'code2',
      '```',
    ]
    const skip = buildSkipLines(lines)
    assert.deepStrictEqual([...skip].sort(), [1, 2, 3, 5, 6, 7])
  })

  it('returns empty set when no code blocks', () => {
    const lines = ['Hello', 'World']
    const skip = buildSkipLines(lines)
    assert.equal(skip.size, 0)
  })

  it('handles indented code fences', () => {
    const lines = ['text', '  ```', '  code', '  ```', 'text']
    const skip = buildSkipLines(lines)
    assert.deepStrictEqual([...skip].sort(), [1, 2, 3])
  })
})

describe('isTranslatable', () => {
  it('returns true for English text', () => {
    assert.equal(isTranslatable('Hello world'), true)
  })

  it('returns true for Chinese text', () => {
    assert.equal(isTranslatable('你好世界'), true)
  })

  it('returns false for empty string', () => {
    assert.equal(isTranslatable(''), false)
  })

  it('returns false for whitespace only', () => {
    assert.equal(isTranslatable('   '), false)
  })

  it('returns false for symbols only', () => {
    assert.equal(isTranslatable('---'), false)
    assert.equal(isTranslatable('***'), false)
    assert.equal(isTranslatable('==='), false)
  })

  it('returns false for HTML comments', () => {
    assert.equal(isTranslatable('<!-- comment -->'), false)
  })

  it('returns true for text with symbols', () => {
    assert.equal(isTranslatable('## Hello'), true)
  })
})
