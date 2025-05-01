import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getProviderBaseURL } from '@elizaos/core';
import type {
  IAgentRuntime,
  ModelTypeName,
  ObjectGenerationParams,
  Plugin,
  GenerateTextParams,
} from '@elizaos/core';
import { EventType, logger, ModelType, safeReplacer } from '@elizaos/core';
import {
  generateObject,
  generateText,
  JSONParseError,
  type JSONValue,
  type LanguageModelUsage,
} from 'ai';
import { fetch } from 'undici';

/**
 * Retrieves a configuration setting from the runtime, falling back to environment variables or a default value if not found.
 *
 * @param key - The name of the setting to retrieve.
 * @param defaultValue - The value to return if the setting is not found in the runtime or environment.
 * @returns The resolved setting value, or {@link defaultValue} if not found.
 */
function getSetting(
  runtime: IAgentRuntime,
  key: string,
  defaultValue?: string
): string | undefined {
  return runtime.getSetting(key) ?? process.env[key] ?? defaultValue;
}

/**
 * Retrieves the OpenAI API base URL from runtime settings, environment variables, or defaults, using provider-aware resolution.
 *
 * @returns The resolved base URL for OpenAI API requests.
 */
function getBaseURL(runtime: IAgentRuntime): string {
  const defaultBaseURL = getSetting(runtime, 'OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
  return getProviderBaseURL(runtime, 'openrouter', defaultBaseURL);
}

/**
 * Helper function to get the API key for OpenAI
 *
 * @param runtime The runtime context
 * @returns The configured API key
 */
function getApiKey(runtime: IAgentRuntime): string | undefined {
  return getSetting(runtime, 'OPENROUTER_API_KEY');
}

/**
 * Helper function to get the small model name with fallbacks
 *
 * @param runtime The runtime context
 * @returns The configured small model name
 */
function getSmallModel(runtime: IAgentRuntime): string {
  return (
    getSetting(runtime, 'OPENROUTER_SMALL_MODEL') ??
    getSetting(runtime, 'SMALL_MODEL', 'google/gemini-flash')
  );
}

/**
 * Helper function to get the large model name with fallbacks
 *
 * @param runtime The runtime context
 * @returns The configured large model name
 */
function getLargeModel(runtime: IAgentRuntime): string {
  return (
    getSetting(runtime, 'OPENROUTER_LARGE_MODEL') ??
    getSetting(runtime, 'LARGE_MODEL', 'google/gemini-pro')
  );
}

/**
 * Create an OpenRouter provider instance with proper configuration
 *
 * @param runtime The runtime context
 * @returns Configured OpenRouter provider instance
 */
function createOpenRouterProvider(runtime: IAgentRuntime) {
  const apiKey = getApiKey(runtime);
  if (!apiKey) {
    // This case should ideally be caught in init, but good practice to check
    logger.error('OpenRouter API Key is missing when trying to create provider');
    throw new Error('OpenRouter API Key is missing.');
  }

  // Note: createOpenRouter doesn't seem to take baseURL directly in the documentation.
  // It might pick it up from OPENROUTER_BASE_URL env var automatically,
  // or it might not be needed/configurable in the same way as createOpenAI.
  // We'll rely on the apiKey for now.
  return createOpenRouter({
    apiKey: apiKey,
    // We might need to handle baseURL differently if required.
    // The @ai-sdk/provider utils might handle OPENROUTER_BASE_URL env var.
  });
}

/**
 * Helper function to generate objects using specified model type
 */
async function generateObjectByModelType(
  runtime: IAgentRuntime,
  params: ObjectGenerationParams,
  modelType: string,
  getModelFn: (runtime: IAgentRuntime) => string
): Promise<JSONValue> {
  const openrouter = createOpenRouterProvider(runtime);
  const modelName = getModelFn(runtime);
  const temperature = params.temperature ?? 0;
  const schemaPresent = !!params.schema;

  if (schemaPresent) {
    logger.info(
      `Using ${modelType} without schema validation (schema provided but output=no-schema)`
    );
  }

  try {
    const { object, usage } = await generateObject({
      model: openrouter.chat(modelName),
      output: 'no-schema',
      prompt: params.prompt,
      temperature: temperature,
      experimental_repairText: getJsonRepairFunction(),
    });

    if (usage) {
      emitModelUsageEvent(runtime, modelType as ModelTypeName, params.prompt, usage);
    }
    return object;
  } catch (error: unknown) {
    if (error instanceof JSONParseError) {
      logger.error(`[generateObject] Failed to parse JSON: ${error.message}`);
      const repairFunction = getJsonRepairFunction();
      const repairedJsonString = await repairFunction({
        text: error.text,
        error,
      });

      if (repairedJsonString) {
        try {
          const repairedObject = JSON.parse(repairedJsonString);
          logger.info('[generateObject] Successfully repaired JSON.');
          return repairedObject;
        } catch (repairParseError: unknown) {
          const message =
            repairParseError instanceof Error ? repairParseError.message : String(repairParseError);
          logger.error(`[generateObject] Failed to parse repaired JSON: ${message}`);
          const exception =
            repairParseError instanceof Error ? repairParseError : new Error(message);
          throw exception;
        }
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error('[generateObject] JSON repair failed.');
        throw error;
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[generateObject] Unknown error: ${message}`);
      const exception = error instanceof Error ? error : new Error(message);
      throw exception;
    }
  }
}

/**
 * Returns a function to repair JSON text
 */
function getJsonRepairFunction(): (params: {
  text: string;
  error: unknown;
}) => Promise<string | null> {
  return async ({ text, error }: { text: string; error: unknown }) => {
    try {
      if (error instanceof JSONParseError) {
        const cleanedText = text.replace(/```json\n|\n```|```/g, '');
        JSON.parse(cleanedText);
        return cleanedText;
      }
      return null;
    } catch (jsonError: unknown) {
      const message = jsonError instanceof Error ? jsonError.message : String(jsonError);
      logger.warn(`Failed to repair JSON text: ${message}`);
      return null;
    }
  };
}

/**
 * Emits a model usage event
 * @param runtime The runtime context
 * @param type The model type
 * @param prompt The prompt used
 * @param usage The LLM usage data
 */
function emitModelUsageEvent(
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

/**
 * Defines the OpenAI plugin with its name, description, and configuration options.
 * @type {Plugin}
 */
export const openaiPlugin: Plugin = {
  name: 'openrouter',
  description: 'OpenAI plugin',
  config: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    OPENROUTER_SMALL_MODEL: process.env.OPENROUTER_SMALL_MODEL,
    OPENROUTER_LARGE_MODEL: process.env.OPENROUTER_LARGE_MODEL,
    SMALL_MODEL: process.env.SMALL_MODEL,
    LARGE_MODEL: process.env.LARGE_MODEL,
  },
  async init(_config, runtime) {
    try {
      if (!getApiKey(runtime)) {
        logger.warn(
          'OPENROUTER_API_KEY is not set in environment - OpenAI functionality will be limited'
        );
        return;
      }
      try {
        const baseURL = getBaseURL(runtime);
        const response = await fetch(`${baseURL}/models`, {
          headers: { Authorization: `Bearer ${getApiKey(runtime)}` },
        });
        if (!response.ok) {
          logger.warn(`OpenAI API key validation failed: ${response.statusText}`);
          logger.warn('OpenAI functionality will be limited until a valid API key is provided');
        } else {
          logger.log('OpenAI API key validated successfully');
        }
      } catch (fetchError: unknown) {
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        logger.warn(`Error validating OpenAI API key: ${message}`);
        logger.warn('OpenAI functionality will be limited until a valid API key is provided');
      }
    } catch (error: unknown) {
      const message =
        (error as { errors?: Array<{ message: string }> })?.errors
          ?.map((e) => e.message)
          .join(', ') || (error instanceof Error ? error.message : String(error));
      logger.warn(
        `OpenAI plugin configuration issue: ${message} - You need to configure the OPENROUTER_API_KEY in your environment variables`
      );
    }
  },
  models: {
    [ModelType.TEXT_SMALL]: async (
      runtime: IAgentRuntime,
      { prompt, stopSequences = [] }: GenerateTextParams
    ) => {
      const temperature = 0.7;
      const frequency_penalty = 0.7;
      const presence_penalty = 0.7;
      const max_response_length = 8192;

      const openrouter = createOpenRouterProvider(runtime);
      const modelName = getSmallModel(runtime);

      logger.log('generating text');
      logger.log(prompt);

      let responseText = '';
      let usage: LanguageModelUsage | undefined;
      const model = openrouter.chat(modelName);
      const system = runtime.character.system ?? undefined;
      const callParams = {
        model: modelName,
        prompt: prompt,
        system: system,
        temperature: temperature,
        maxTokens: max_response_length,
        frequencyPenalty: frequency_penalty,
        presencePenalty: presence_penalty,
        stopSequences: stopSequences,
      };
      logger.debug(
        `[TEXT_SMALL] Calling generateText with params: ${JSON.stringify(callParams, safeReplacer())}`
      );
      try {
        const { text, usage: usageData } = await generateText({
          model: model,
          prompt: prompt,
          system: system,
          temperature: temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          stopSequences: stopSequences,
        });
        responseText = text;
        usage = usageData;
      } catch (e: unknown) {
        logger.error(
          `[TEXT_SMALL] Error during generateText call: ${JSON.stringify(e, Object.getOwnPropertyNames(e), 2)}`
        );
      }

      if (usage) {
        emitModelUsageEvent(runtime, ModelType.TEXT_SMALL, prompt, usage);
      }

      return responseText;
    },
    [ModelType.TEXT_LARGE]: async (
      runtime: IAgentRuntime,
      {
        prompt,
        stopSequences = [],
        maxTokens = 8192,
        temperature = 0.7,
        frequencyPenalty = 0.7,
        presencePenalty = 0.7,
      }: GenerateTextParams
    ) => {
      const openrouter = createOpenRouterProvider(runtime);
      const modelName = getLargeModel(runtime);

      logger.log('generating text');
      logger.log(prompt);

      let responseText = '';
      let usage: LanguageModelUsage | undefined;
      try {
        const { text, usage: usageData } = await generateText({
          model: openrouter.chat(modelName),
          prompt: prompt,
          system: runtime.character.system ?? undefined,
          temperature: temperature,
          maxTokens: maxTokens,
          frequencyPenalty: frequencyPenalty,
          presencePenalty: presencePenalty,
          stopSequences: stopSequences,
        });
        responseText = text;
        usage = usageData;
      } catch (e: unknown) {
        logger.error(
          `[TEXT_LARGE] Error during generateText call: ${JSON.stringify(e, Object.getOwnPropertyNames(e), 2)}`
        );
      }

      if (usage) {
        emitModelUsageEvent(runtime, ModelType.TEXT_LARGE, prompt, usage);
      }

      return responseText;
    },
    [ModelType.OBJECT_SMALL]: async (runtime: IAgentRuntime, params: ObjectGenerationParams) => {
      return generateObjectByModelType(runtime, params, ModelType.OBJECT_SMALL, getSmallModel);
    },
    [ModelType.OBJECT_LARGE]: async (runtime: IAgentRuntime, params: ObjectGenerationParams) => {
      return generateObjectByModelType(runtime, params, ModelType.OBJECT_LARGE, getLargeModel);
    },
  },
};
export default openaiPlugin;
