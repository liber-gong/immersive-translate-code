import { TranslationService } from './types'
import { GoogleTranslateTranslator } from './google'
import { OpenAICompatibleTranslator } from './openai-compatible'
import { BedrockTranslator } from './bedrock'
import { PRESETS } from './presets'

export type Provider = 'google-translate' | 'openai' | 'deepseek' | 'gemini' | 'custom' | 'bedrock';

export interface TranslatorConfig {
  provider: Provider;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  awsRegion?: string;
  awsProfile?: string;
  awsBedrockModelId?: string;
}

export function createTranslator(config: TranslatorConfig): TranslationService {
  if (config.provider === 'google-translate') {
    return new GoogleTranslateTranslator()
  }

  if (config.provider === 'bedrock') {
    if (!config.awsRegion) {
      throw new Error('AWS Region is required for Bedrock provider')
    }
    if (!config.awsBedrockModelId) {
      throw new Error('Bedrock Model ID is required for Bedrock provider')
    }
    return new BedrockTranslator({
      region: config.awsRegion,
      profile: config.awsProfile ?? '',
      modelId: config.awsBedrockModelId,
    })
  }

  const preset = PRESETS[config.provider]
  const baseURL = config.baseURL || preset?.baseURL
  const model = config.model || preset?.model
  const apiKey = config.apiKey

  if (!apiKey) {
    throw new Error(`API key is required for provider: ${config.provider}`)
  }
  if (!baseURL || !model) {
    throw new Error(`baseURL and model are required for custom provider`)
  }

  return new OpenAICompatibleTranslator({ baseURL, apiKey, model, provider: config.provider })
}
