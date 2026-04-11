import { TranslationResult } from './types'
import { BaseTranslator } from './base'
import { log } from '../logger'

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
    log('bedrock', `importing @aws-sdk/client-bedrock-runtime...`)
    const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    log('bedrock', `SDK imported OK`)

    const client = await this.getClient()

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
      temperature: 0,
    })

    log('bedrock', `invoking model=${this.opts.modelId} text=${text.slice(0, 80)}...`)
    const command = new InvokeModelCommand({
      modelId: this.opts.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    })

    const response = await client.send(command)
    const result = JSON.parse(new TextDecoder().decode(response.body))
    const translated = (result.content?.[0]?.text ?? '').trim()
    log('bedrock', `response: ${translated.slice(0, 120)}`)
    this.assertNotEmpty(translated, 'bedrock')

    return { text: translated, source, target, provider: 'bedrock' }
  }

  private async getClient() {
    const { region, profile } = this.opts
    if (this.client && this.clientConfig.region === region && this.clientConfig.profile === profile) {
      log('bedrock', `reusing cached client (region=${region} profile=${profile || '(default)'})`)
      return this.client as import('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient
    }

    log('bedrock', `creating new client: region=${region} profile=${profile || '(default)'}`)
    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const clientOpts: Record<string, unknown> = { region }

    if (profile) {
      log('bedrock', `loading SSO credentials for profile=${profile}`)
      const { fromSSO } = await import('@aws-sdk/credential-providers')
      clientOpts.credentials = fromSSO({ profile })
    }

    this.client = new BedrockRuntimeClient(clientOpts)
    this.clientConfig = { region, profile }
    log('bedrock', `client created OK`)
    return this.client as import('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient
  }
}
