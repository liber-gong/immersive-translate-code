import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseNumberedResult } from '../translator/parse'

describe('parseNumberedResult', () => {
  it('parses numbered lines correctly', () => {
    const text = '[0] 你好\n[1] 世界\n[2] 测试'
    assert.deepStrictEqual(parseNumberedResult(text, 3), ['你好', '世界', '测试'])
  })

  it('handles extra whitespace in results', () => {
    const text = '[0]  你好 \n[1]  世界 '
    assert.deepStrictEqual(parseNumberedResult(text, 2), ['你好', '世界'])
  })

  it('ignores non-numbered lines', () => {
    const text = 'Here are the translations:\n[0] 你好\n[1] 世界'
    assert.deepStrictEqual(parseNumberedResult(text, 2), ['你好', '世界'])
  })

  it('returns null when less than 50% filled', () => {
    const text = '[0] 你好'
    assert.equal(parseNumberedResult(text, 4), null)
  })

  it('tolerates partially missing lines', () => {
    const text = '[0] 你好\n[2] 测试'
    // 2 out of 3 = 67% >= 50%
    assert.deepStrictEqual(parseNumberedResult(text, 3), ['你好', '', '测试'])
  })

  it('ignores out-of-range indices', () => {
    const text = '[0] 你好\n[1] 世界\n[5] 超出范围'
    assert.deepStrictEqual(parseNumberedResult(text, 2), ['你好', '世界'])
  })
})
