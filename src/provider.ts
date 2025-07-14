import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { logger, type IAgentRuntime } from '@elizaos/core';
import { getApiKey } from './utils/config';

/**
 * Create an OpenRouter provider instance with proper configuration
 */
export function createOpenRouterProvider(runtime: IAgentRuntime) {
  const apiKey = getApiKey(runtime);
  if (!apiKey) {
    logger.error('OpenRouter API Key is missing when trying to create provider');
    throw new Error('OpenRouter API Key is missing.');
  }

  return createOpenRouter({
    apiKey: apiKey,
  });
}