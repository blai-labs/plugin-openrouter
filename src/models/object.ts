import { ModelType, logger, type IAgentRuntime, type ObjectGenerationParams } from '@elizaos/core';
import { generateObject, JSONParseError } from 'ai';
import { createOpenRouterProvider } from '../providers';
import { getSmallModel, getLargeModel } from '../utils/config';
import { emitModelUsageEvent } from '../utils/events';
import { getJsonRepairFunction } from '../utils/response';

/**
 * Common object generation logic for both small and large models
 */
async function generateObjectWithModel(
  runtime: IAgentRuntime,
  modelType: ModelType,
  params: ObjectGenerationParams
): Promise<unknown> {
  const openrouter = createOpenRouterProvider(runtime);
  const modelName = modelType === ModelType.OBJECT_SMALL ? getSmallModel(runtime) : getLargeModel(runtime);
  const modelLabel = modelType === ModelType.OBJECT_SMALL ? 'OBJECT_SMALL' : 'OBJECT_LARGE';
  
  logger.log(`[OpenRouter] Using ${modelLabel} model: ${modelName}`);
  const temperature = params.temperature ?? 0;

  try {
    const { object, usage } = await generateObject({
      model: openrouter.chat(modelName),
      output: 'no-schema',
      prompt: params.prompt,
      temperature: temperature,
      experimental_repairText: getJsonRepairFunction(),
    });

    if (usage) {
      emitModelUsageEvent(runtime, modelType, params.prompt, usage);
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
          logger.log('[generateObject] Successfully repaired JSON.');
          return repairedObject;
        } catch (repairParseError: unknown) {
          const message = repairParseError instanceof Error ? repairParseError.message : String(repairParseError);
          logger.error(`[generateObject] Failed to parse repaired JSON: ${message}`);
          throw repairParseError;
        }
      } else {
        throw error;
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[generateObject] Unknown error: ${message}`);
      throw error;
    }
  }
}

/**
 * OBJECT_SMALL model handler
 */
export async function handleObjectSmall(runtime: IAgentRuntime, params: ObjectGenerationParams): Promise<unknown> {
  return generateObjectWithModel(runtime, ModelType.OBJECT_SMALL, params);
}

/**
 * OBJECT_LARGE model handler
 */
export async function handleObjectLarge(runtime: IAgentRuntime, params: ObjectGenerationParams): Promise<unknown> {
  return generateObjectWithModel(runtime, ModelType.OBJECT_LARGE, params);
}