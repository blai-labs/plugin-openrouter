import { logger, EventType, type IAgentRuntime, type ModelTypeName } from '@elizaos/core';
import { JSONParseError, type LanguageModelUsage } from 'ai';
import type { GenerateTextResponse, ImageDescriptionResult } from '../types';

/**
 * Returns a function to repair JSON text
 */
export function getJsonRepairFunction(): (params: {
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

/**
 * Logs response structure for debugging (debug level only)
 */
export function logResponseStructure(modelType: string, response: GenerateTextResponse) {
  logger.debug(`[${modelType}] Response structure:`, {
    hasText: !!response.text,
    textLength: response.text?.length || 0,
    hasSteps: !!response.steps,
    stepsCount: response.steps?.length || 0,
    finishReason: response.finishReason,
    usage: response.usage
  });
}

/**
 * Handles cases where tool execution doesn't generate text
 */
export function handleEmptyToolResponse(modelType: string): string {
  logger.warn(`[${modelType}] No text generated after tool execution`);
  
  const fallbackText = 'I executed the requested action. The tool completed successfully.';
  logger.warn(`[${modelType}] Using fallback response text`);
  return fallbackText;
}

/**
 * Parses image description response from text or JSON format
 */
export function parseImageDescriptionResponse(responseText: string): ImageDescriptionResult {
  // Try to parse as JSON first
  try {
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.title && jsonResponse.description) {
      return jsonResponse;
    }
  } catch (e) {
    // If not valid JSON, process as text
    logger.debug(`Parsing as JSON failed, processing as text: ${e}`);
  }

  // Extract title and description from text format
  const titleMatch = responseText.match(/title[:\s]+(.+?)(?:\n|$)/i);
  const title = titleMatch?.[1]?.trim() || 'Image Analysis';
  const description = responseText.replace(/title[:\s]+(.+?)(?:\n|$)/i, '').trim();

  return { title, description };
}

/**
 * Handles errors during object generation, including JSON repair attempts
 */
export async function handleObjectGenerationError(error: unknown): Promise<unknown> {
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
        const message =
          repairParseError instanceof Error ? repairParseError.message : String(repairParseError);
        logger.error(`[generateObject] Failed to parse repaired JSON: ${message}`);
        throw repairParseError instanceof Error ? repairParseError : new Error(message);
      }
    } else {
      logger.error('[generateObject] JSON repair failed.');
      throw error;
    }
  } else {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[generateObject] Unknown error: ${message}`);
    throw error instanceof Error ? error : new Error(message);
  }
}