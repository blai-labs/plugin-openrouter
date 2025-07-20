import type { GenerateTextParams, IAgentRuntime } from "@elizaos/core";
import { logger, ModelType } from "@elizaos/core";
import { generateText } from "ai";
import type { Tool, ToolChoice } from "ai";

import { createOpenRouterProvider } from "../providers";
import type { ToolCall, ToolResponse, ToolResult } from "../types";
import { getSmallModel, getLargeModel } from "../utils/config";
import { emitModelUsageEvent } from "../utils/events";
import { handleEmptyToolResponse } from "../utils/helpers";

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
	const maxResponseLength = params.maxTokens ?? 8192;

	const openrouter = createOpenRouterProvider(runtime);
	const modelName =
		modelType === ModelType.TEXT_SMALL
			? getSmallModel(runtime)
			: getLargeModel(runtime);
	const modelLabel =
		modelType === ModelType.TEXT_SMALL ? "TEXT_SMALL" : "TEXT_LARGE";

	logger.log(
		`[OpenRouter] Generating text with ${modelLabel} model: ${modelName}`,
	);

	const generateParams: Parameters<typeof generateText>[0] & {
		extra_body?: { provider?: { require_parameters?: boolean } };
	} = {
		model: openrouter.chat(modelName),
		prompt: prompt,
		system: runtime.character.system ?? undefined,
		temperature: temperature,
		maxTokens: maxResponseLength,
		frequencyPenalty: frequencyPenalty,
		presencePenalty: presencePenalty,
		stopSequences: stopSequences,
	};

	// Add tools if provided
	if (tools) {
		generateParams.tools = tools;
		generateParams.maxSteps = 10; // Allow tool call + response generation
		// For OpenRouter: ensure request is only routed to providers that support function calling
		generateParams.extra_body = {
			provider: {
				require_parameters: true,
			},
		};
	}

	// Add toolChoice if provided
	if (toolChoice) {
		generateParams.toolChoice = toolChoice;
	}

	// Capture tool results if tools are used
	let capturedToolResults: ToolResult[] = [];
	let capturedToolCalls: ToolCall[] = [];

	if (tools) {
		generateParams.onStepFinish = async (stepResult) => {
			if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
				capturedToolCalls = [...capturedToolCalls, ...stepResult.toolCalls];
			}
			if (stepResult.toolResults && stepResult.toolResults.length > 0) {
				capturedToolResults = [...capturedToolResults, ...stepResult.toolResults];
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

	// If tools were used, return the full response object to access toolCalls and toolResults
	if (
		tools &&
		(capturedToolCalls.length > 0 || capturedToolResults.length > 0)
	) {
		return {
			text: responseText,
			toolCalls: capturedToolCalls,
			toolResults: capturedToolResults,
			// Include other useful properties
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
