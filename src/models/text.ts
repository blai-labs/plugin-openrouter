import type { GenerateTextParams, IAgentRuntime } from "@elizaos/core";
import { logger, ModelType } from "@elizaos/core";
import { generateText, stepCountIs } from "ai";
import type { Tool, ToolChoice } from "ai";

import { createOpenRouterProvider } from "../providers";
import type { ToolCall, ToolResponse, ToolResult } from "../types";
import { getSmallModel, getLargeModel, getToolExecutionMaxSteps } from "../utils/config";
import { emitModelUsageEvent } from "../utils/events";
import { handleEmptyToolResponse, decodeBase64Fields } from "../utils/helpers";

/**
 * Common text generation logic for both small and large models
 */
async function generateTextWithModel(
  runtime: IAgentRuntime,
  modelType: typeof ModelType.TEXT_SMALL | typeof ModelType.TEXT_LARGE,
  params: GenerateTextParams & {
    tools?: Record<string, Tool>;
    toolChoice?: ToolChoice<Record<string, Tool>>;
  },
): Promise<string | ToolResponse> {
  const { prompt, stopSequences = [], tools, toolChoice } = params;
  const temperature = params.temperature ?? 0.7;
  const frequencyPenalty = params.frequencyPenalty ?? 0.7;
  const presencePenalty = params.presencePenalty ?? 0.7;
  // AI SDK v5: prefer maxOutputTokens; keep legacy maxTokens as fallback; default 8192
  const resolvedMaxOutput =
    (params as any).maxOutputTokens ?? (params as any).maxTokens ?? 8192;

  const openrouter = createOpenRouterProvider(runtime);
  const modelName =
    modelType === ModelType.TEXT_SMALL
      ? getSmallModel(runtime)
      : getLargeModel(runtime);
  const modelLabel =
    modelType === ModelType.TEXT_SMALL ? "TEXT_SMALL" : "TEXT_LARGE";

  logger.debug(
    `[OpenRouter] Generating text with ${modelLabel} model: ${modelName}`,
  );

  const generateParams: Parameters<typeof generateText>[0] = {
    model: openrouter.chat(modelName),
    prompt: prompt,
    system: runtime.character.system ?? undefined,
    temperature: temperature,
    frequencyPenalty: frequencyPenalty,
    presencePenalty: presencePenalty,
    stopSequences: stopSequences,
  };

  (generateParams as any).maxOutputTokens = resolvedMaxOutput;

  // Add tools if provided
  if (tools) {
    (generateParams as any).tools = tools;
    const maxSteps = getToolExecutionMaxSteps(runtime);

    (generateParams as any).stopWhen = stepCountIs(maxSteps);
    logger.debug(`[OpenRouter] Using maxSteps: ${maxSteps} for tool execution`);
  }

  // Add toolChoice if provided
  if (toolChoice) {
    (generateParams as any).toolChoice = toolChoice;
  }

  // Capture tool results if tools are used
  let capturedToolResults: ToolResult[] = [];
  let capturedToolCalls: ToolCall[] = [];

  if (tools) {
    (generateParams as any).onStepFinish = async (stepResult: any) => {
      if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
        capturedToolCalls = [
          ...capturedToolCalls,
          ...(stepResult.toolCalls as any),
        ];
      }

      // Extract tool results from content array in steps
      if (stepResult.content && Array.isArray(stepResult.content)) {
        const toolResultsFromContent = stepResult.content
          .filter((content: any) => content.type === 'tool-result' && content.output)
          .map((content: any) => ({
            toolCallId: content.toolCallId,
            result: decodeBase64Fields(content.output),
          }));

        if (toolResultsFromContent.length > 0) {
          capturedToolResults = [...capturedToolResults, ...toolResultsFromContent];
        }
      }
    };
  }

  const response = await generateText(generateParams);

  // Handle cases where tool execution doesn't generate text
  let responseText: string;
  if (
    tools &&
    (!response.text ||
      response.text.trim() === "" ||
      response.text === "Tools executed successfully.")
  ) {
    responseText = handleEmptyToolResponse(modelLabel);
  } else {
    responseText = response.text;
  }

  if (response.usage) {
    emitModelUsageEvent(runtime, modelType, prompt, response.usage);
  }

  // If tools were used, return the full response object with steps for proper tool results access
  if (tools && response.steps && response.steps.length > 0) {
    return {
      text: responseText,
      toolCalls: capturedToolCalls,
      toolResults: capturedToolResults,
      steps: response.steps,
      usage: response.usage,
      finishReason: response.finishReason,
    };
  }

  return responseText;
}

/**
 * TEXT_SMALL model handler
 */
export async function handleTextSmall(
  runtime: IAgentRuntime,
  params: GenerateTextParams & {
    tools?: Record<string, Tool>;
    toolChoice?: ToolChoice<Record<string, Tool>>;
  },
): Promise<string | ToolResponse> {
  return generateTextWithModel(runtime, ModelType.TEXT_SMALL, params);
}

/**
 * TEXT_LARGE model handler
 */
export async function handleTextLarge(
  runtime: IAgentRuntime,
  params: GenerateTextParams & {
    tools?: Record<string, Tool>;
    toolChoice?: ToolChoice<Record<string, Tool>>;
  },
): Promise<string | ToolResponse> {
  return generateTextWithModel(runtime, ModelType.TEXT_LARGE, params);
}
