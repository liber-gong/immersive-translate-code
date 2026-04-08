import { TranslationService, TranslationResult } from './types'

const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single'

export class GoogleTranslateTranslator implements TranslationService {
  async translate(text: string, source: string, target: string): Promise<TranslationResult> {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: source,
      tl: target,
      dt: 't',
      q: text,
    })

    const response = await fetch(`${GOOGLE_TRANSLATE_URL}?${params}`)
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
      provider: 'google-translate',
    }
  }
}
