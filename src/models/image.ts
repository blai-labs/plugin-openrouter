import {
  logger,
  type IAgentRuntime,
  type ImageDescriptionParams,
} from "@elizaos/core";
import { generateText } from "ai";
import { createOpenRouterProvider } from "../providers";
import { getImageModel } from "../utils/config";
import { parseImageDescriptionResponse } from "../utils/helpers";

/**
 * IMAGE_DESCRIPTION model handler
 */
export async function handleImageDescription(
  runtime: IAgentRuntime,
  params: ImageDescriptionParams | string,
): Promise<{ title: string; description: string }> {
  let imageUrl: string;
  let promptText: string | undefined;
  const modelName = getImageModel(runtime);
  logger.log(`[OpenRouter] Using IMAGE_DESCRIPTION model: ${modelName}`);
  const maxTokens = 300;

  if (typeof params === "string") {
    imageUrl = params;
    promptText =
      "Please analyze this image and provide a title and detailed description.";
  } else {
    imageUrl = params.imageUrl;
    promptText =
      params.prompt ||
      "Please analyze this image and provide a title and detailed description.";
  }

  const openrouter = createOpenRouterProvider(runtime);

  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: promptText },
        { type: "image" as const, image: imageUrl },
      ],
    },
  ];

  try {
    const model = openrouter.chat(modelName);

    const { text: responseText } = await generateText({
      model: model,
      messages: messages,
      maxTokens: maxTokens,
    });

    return parseImageDescriptionResponse(responseText);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error analyzing image: ${message}`);
    return {
      title: "Failed to analyze image",
      description: `Error: ${message}`,
    };
  }
}
