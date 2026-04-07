import { TranslationResult } from './types'
import { BaseTranslator } from './base'

export interface BedrockOptions {
  region: string
  profile: string
  modelId: string
}

export class BedrockTranslator extends BaseTranslator {
  private client: unknown | undefined
  private clientConfig = { region: '', profile: '' }

  constructor(private opts: BedrockOptions) { super() }

  protected async call(text: string, systemPrompt: string, source: string, target: string): Promise<TranslationResult> {
    const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const client = await this.getClient()

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
      temperature: 0.3,
    })

    const command = new InvokeModelCommand({
      modelId: this.opts.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    })

    const response = await client.send(command)
    const result = JSON.parse(new TextDecoder().decode(response.body))
    const translated = (result.content?.[0]?.text ?? '').trim()
    this.assertNotEmpty(translated, 'bedrock')

    return { text: translated, source, target, provider: 'bedrock' }
  }

  private async getClient() {
    const { region, profile } = this.opts
    if (this.client && this.clientConfig.region === region && this.clientConfig.profile === profile) {
      return this.client as import('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient
    }

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const clientOpts: Record<string, unknown> = { region }

    if (profile) {
      const { fromSSO } = await import('@aws-sdk/credential-providers')
      clientOpts.credentials = fromSSO({ profile })
    }

    this.client = new BedrockRuntimeClient(clientOpts)
    this.clientConfig = { region, profile }
    return this.client as import('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient
  }
}
