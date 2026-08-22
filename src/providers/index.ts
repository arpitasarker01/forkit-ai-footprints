import type { RuntimeProvider } from '../types';
import { LMStudioProvider } from './lmstudio';
import { OllamaProvider } from './ollama';
import { configuredOpenAICompatibleProviders } from './openai-compatible';

export { LMStudioProvider } from './lmstudio';
export { OllamaProvider } from './ollama';
export { OpenAICompatibleProvider, configuredOpenAICompatibleProviders } from './openai-compatible';

export function createDefaultProviders(fetchImpl: typeof fetch = fetch): RuntimeProvider[] {
  if (process.env.FORKIT_CENSUS_DISABLE_DEFAULT_RUNTIMES === '1') return [];
  return [
    new OllamaProvider('http://localhost:11434', fetchImpl),
    new LMStudioProvider('http://localhost:1234', fetchImpl),
    ...configuredOpenAICompatibleProviders(
      process.env.FORKIT_CENSUS_OPENAI_ENDPOINTS ?? 'http://localhost:8000',
      fetchImpl,
    ),
  ];
}
