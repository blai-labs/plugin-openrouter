import { logger } from "@elizaos/core";
import { JSONParseError } from "ai";
import type { GenerateTextResponse, ImageDescriptionResult } from "../types";

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
        const cleanedText = text.replace(/```json\n|\n```|```/g, "");
        JSON.parse(cleanedText);
        return cleanedText;
      }
      return null;
    } catch (jsonError: unknown) {
      const message =
        jsonError instanceof Error ? jsonError.message : String(jsonError);
      logger.warn(`Failed to repair JSON text: ${message}`);
      return null;
    }
  };
}

// Re-export for backward compatibility
export { emitModelUsageEvent } from "./events";

/**
 * Logs response structure for debugging (debug level only)
 */
export function logResponseStructure(
  modelType: string,
  response: GenerateTextResponse,
) {
  // Only log safe, non-sensitive usage fields (avoid raw request bodies)
  const u = (response as any)?.usage;
  const safeUsage =
    u && typeof u === "object"
      ? {
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          totalTokens: u.totalTokens,
        }
      : undefined;
  logger.debug(
    `[${modelType}] Response structure: ${JSON.stringify(
      {
        hasText: !!response.text,
        textLength: response.text?.length || 0,
        hasSteps: !!response.steps,
        stepsCount: response.steps?.length || 0,
        finishReason: response.finishReason,
        usage: safeUsage,
      },
      null,
      2,
    )}`,
  );
}

/**
 * Handles cases where tool execution doesn't generate text
 */
export function handleEmptyToolResponse(modelType: string): string {
  logger.warn(`[${modelType}] No text generated after tool execution`);

  const fallbackText =
    "I executed the requested action. The tool completed successfully.";
  logger.warn(`[${modelType}] Using fallback response text`);
  return fallbackText;
}

/**
 * Parses image description response from text or JSON format
 */
export function parseImageDescriptionResponse(
  responseText: string,
): ImageDescriptionResult {
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
  const title = titleMatch?.[1]?.trim() || "Image Analysis";
  const description = responseText
    .replace(/title[:\s]+(.+?)(?:\n|$)/i, "")
    .trim();

  return { title, description };
}

/**
 * Handles errors during object generation, including JSON repair attempts
 */
export async function handleObjectGenerationError(
  error: unknown,
): Promise<unknown> {
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
        logger.log("[generateObject] Successfully repaired JSON.");
        return repairedObject;
      } catch (repairParseError: unknown) {
        const message =
          repairParseError instanceof Error
            ? repairParseError.message
            : String(repairParseError);
        logger.error(
          `[generateObject] Failed to parse repaired JSON: ${message}`,
        );
        if (repairParseError instanceof Error) throw repairParseError;
        throw Object.assign(new Error(message), { cause: repairParseError });
      }
    } else {
      logger.error("[generateObject] JSON repair failed.");
      throw error;
    }
  } else {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[generateObject] Unknown error: ${message}`);
    if (error instanceof Error) throw error;
    throw Object.assign(new Error(message), { cause: error });
  }
}

/**
 * Quick heuristic to detect if a field likely contains base64 data
 */
function isLikelyBase64(key: string, value: string): boolean {
  // Check key name patterns (expanded base64 field names)
  const base64KeyPattern =
    /^(data|content|body|payload|encoded|b64|base64|document)$/i;
  if (!base64KeyPattern.test(key)) return false;

  // Basic format checks
  if (value.length < 20 || value.length > 1024 * 1024) return false; // Size limits
  if (value.length % 4 !== 0) return false; // Invalid base64 length
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false; // Invalid chars

  return true;
}

/**
 * Recursively decodes base64 fields in tool results
 */
export function decodeBase64Fields(obj: unknown, depth = 0): unknown {
  // Simple depth protection
  if (depth > 5) return obj;
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj))
    return obj.map((item) => decodeBase64Fields(item, depth + 1));

  const decoded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && isLikelyBase64(key, value)) {
      try {
        decoded[key] = Buffer.from(value, "base64").toString("utf8");
        logger.debug(
          `[decodeBase64] Decoded field '${key}' (${value.length} chars)`,
        );
      } catch (error) {
        logger.warn(`[decodeBase64] Failed to decode field '${key}': ${error}`);
        decoded[key] = value; // Keep original if decode fails
      }
    } else if (value && typeof value === "object") {
      decoded[key] = decodeBase64Fields(value, depth + 1);
    } else {
      decoded[key] = value;
    }
  }
  return decoded;
}
