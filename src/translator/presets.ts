export interface ProviderPreset {
  baseURL: string;
  model: string;
  label: string;
}

export const PRESETS: Record<string, ProviderPreset> = {
  openai:   { baseURL: 'https://api.openai.com/v1', model: 'gpt-4.1-nano', label: 'OpenAI' },
  deepseek: { baseURL: 'https://api.deepseek.com', model: 'deepseek-chat', label: 'DeepSeek' },
  gemini:   { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', label: 'Gemini' },
}
