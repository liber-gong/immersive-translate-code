import { TranslationService, TranslationResult } from './types'

const GOOGLE_FREE_URL = 'https://translate.googleapis.com/translate_a/single'

export class GoogleFreeTranslator implements TranslationService {
  async translate(text: string, source: string, target: string): Promise<TranslationResult> {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: source,
      tl: target,
      dt: 't',
      q: text,
    })

    const response = await fetch(`${GOOGLE_FREE_URL}?${params}`)
    if (!response.ok) {
      throw new Error(`Google Translate HTTP ${response.status}`)
    }

    const data = await response.json() as [unknown[][], unknown, string?]
    // Response format: [[["translated", "source", ...], ...], null, "detected_lang"]
    const translatedText = data[0]
      .map((item: unknown[]) => item[0])
      .join('')
    const detectedSource = data[2] || source

    return {
      text: translatedText,
      source: detectedSource,
      target,
      provider: 'google-free',
    }
  }
}
