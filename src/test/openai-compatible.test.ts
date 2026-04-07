import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { OpenAICompatibleTranslator } from '../translator/openai-compatible'

const OPTS = { baseURL: 'https://api.example.com/v1', apiKey: 'test-key', model: 'test-model', provider: 'test' }

describe('OpenAICompatibleTranslator', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends correct request and parses response', async () => {
    let capturedURL = ''
    let capturedBody: Record<string, unknown> = {}
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      capturedURL = String(input)
      capturedHeaders = Object.fromEntries(Object.entries(init?.headers as Record<string, string>))
      capturedBody = JSON.parse(init?.body as string)
      return new Response(JSON.stringify({
        choices: [{ message: { content: '你好世界' } }],
      }))
    }

    const translator = new OpenAICompatibleTranslator(OPTS)
    const result = await translator.translate('Hello world', 'en', 'zh-CN')

    assert.equal(result.text, '你好世界')
    assert.equal(result.provider, 'test')
    assert.equal(capturedURL, 'https://api.example.com/v1/chat/completions')
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-key')
    assert.equal(capturedBody['model'], 'test-model')
  })

  it('throws on HTTP error', async () => {
    globalThis.fetch = async () => new Response('Unauthorized', { status: 401 })

    const translator = new OpenAICompatibleTranslator(OPTS)
    await assert.rejects(() => translator.translate('Hello', 'en', 'zh-CN'), /HTTP 401/)
  })

  it('uses batch prompt for translateBatch', async () => {
    let capturedBody: Record<string, unknown> = {}

    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string)
      return new Response(JSON.stringify({
        choices: [{ message: { content: '[0] 你好\n[1] 世界' } }],
      }))
    }

    const translator = new OpenAICompatibleTranslator(OPTS)
    const result = await translator.translateBatch('[0] Hello\n[1] World', 'en', 'zh-CN')

    const messages = capturedBody['messages'] as Array<{ role: string; content: string }>
    const systemPrompt = messages[0].content
    assert.ok(systemPrompt.includes('[N] prefix'), `system prompt should mention [N] prefix: ${systemPrompt}`)
    assert.equal(result.text, '[0] 你好\n[1] 世界')
  })

  it('throws on empty response', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: '' } }],
    }))

    const translator = new OpenAICompatibleTranslator(OPTS)
    await assert.rejects(() => translator.translate('Hello', 'en', 'zh-CN'), /empty translation/)
  })
})
