import { TranslationResult } from './types'
import { BaseTranslator } from './base'

interface OpenAICompatibleOptions {
  baseURL: string
  apiKey: string
  model: string
  provider: string
}

interface ChatResponse {
  choices: Array<{ message: { content: string } }>
}

export class OpenAICompatibleTranslator extends BaseTranslator {
  constructor(private opts: OpenAICompatibleOptions) { super() }

  protected async call(text: string, systemPrompt: string, source: string, target: string): Promise<TranslationResult> {
    const { baseURL, apiKey, model, provider } = this.opts

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0,
      }),
    })

    if (!response.ok) {
      throw new Error(`${provider} API HTTP ${response.status}`)
    }

    const data = await response.json() as ChatResponse
    const translated = data.choices[0]?.message?.content?.trim() ?? ''
    this.assertNotEmpty(translated, provider)

    return { text: translated, source, target, provider }
  }
}
