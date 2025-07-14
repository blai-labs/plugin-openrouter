import { EventType, type IAgentRuntime, type ModelTypeName } from '@elizaos/core';
import type { LanguageModelUsage } from 'ai';

/**
 * Emits a model usage event
 */
export function emitModelUsageEvent(
  runtime: IAgentRuntime,
  type: ModelTypeName,
  prompt: string,
  usage: LanguageModelUsage
) {
  runtime.emitEvent(EventType.MODEL_USED, {
    provider: 'openrouter',
    type,
    prompt,
    tokens: {
      prompt: usage.promptTokens,
      completion: usage.completionTokens,
      total: usage.totalTokens,
    },
  });
}