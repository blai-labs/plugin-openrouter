import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { logger, type IAgentRuntime } from "@elizaos/core";
import { getApiKey } from "../utils/config";

/**
 * Create an OpenRouter provider instance with proper configuration
 *
 * @param runtime The runtime context
 * @returns Configured OpenRouter provider instance
 */
export function createOpenRouterProvider(runtime: IAgentRuntime) {
  const apiKey = getApiKey(runtime);
  if (!apiKey) {
    // This case should ideally be caught in init, but good practice to check
    logger.error(
      "OpenRouter API Key is missing when trying to create provider",
    );
    throw new Error("OpenRouter API Key is missing.");
  }

  // Note: createOpenRouter doesn't seem to take baseURL directly in the documentation.
  // It might pick it up from OPENROUTER_BASE_URL env var automatically,
  // or it might not be needed/configurable in the same way as createOpenRouter.
  // We'll rely on the apiKey for now.
  return createOpenRouter({
    apiKey: apiKey,
    // We might need to handle baseURL differently if required.
    // The @ai-sdk/provider utils might handle OPENROUTER_BASE_URL env var.
  });
}
