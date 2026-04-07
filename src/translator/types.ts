export interface TranslationResult {
  text: string;
  source: string;
  target: string;
  provider: string;
}

export interface TranslationService {
  translate(text: string, source: string, target: string): Promise<TranslationResult>;
  translateBatch?(text: string, source: string, target: string): Promise<TranslationResult>;
}
