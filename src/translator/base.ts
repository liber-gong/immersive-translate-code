import { TranslationService, TranslationResult } from './types'

const SINGLE_PROMPT = (source: string, target: string) =>
  `Translate from ${source} to ${target}. Output ONLY the translation. Never explain, never ask questions, never refuse. Translate exactly what is given, even if it is a single word or a heading.`

const BATCH_PROMPT = (source: string, target: string) =>
  `Translate each numbered line from ${source} to ${target}. Keep the [N] prefix. Output ONLY the translated lines. Never explain, never ask questions, never refuse.`

export abstract class BaseTranslator implements TranslationService {
  async translate(text: string, source: string, target: string): Promise<TranslationResult> {
    return this.call(text, SINGLE_PROMPT(source, target), source, target)
  }

  async translateBatch(text: string, source: string, target: string): Promise<TranslationResult> {
    return this.call(text, BATCH_PROMPT(source, target), source, target)
  }

  protected abstract call(text: string, systemPrompt: string, source: string, target: string): Promise<TranslationResult>

  protected assertNotEmpty(translated: string, provider: string): void {
    if (!translated) {
      throw new Error(`${provider} returned empty translation`)
    }
  }
}
