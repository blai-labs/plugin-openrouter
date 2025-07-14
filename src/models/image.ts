import { logger, type IAgentRuntime, type ImageDescriptionParams } from '@elizaos/core';
import { generateText } from 'ai';
import { createOpenRouterProvider } from '../providers';
import { getImageModel } from '../utils/config';

/**
 * IMAGE_DESCRIPTION model handler
 */
export async function handleImageDescription(
  runtime: IAgentRuntime,
  params: ImageDescriptionParams | string
): Promise<{ title: string; description: string }> {
  let imageUrl: string;
  let promptText: string | undefined;
  const modelName = getImageModel(runtime);
  logger.log(`[OpenRouter] Using IMAGE_DESCRIPTION model: ${modelName}`);
  const maxTokens = 300;

  if (typeof params === 'string') {
    imageUrl = params;
    promptText = 'Please analyze this image and provide a title and detailed description.';
  } else {
    imageUrl = params.imageUrl;
    promptText = params.prompt || 'Please analyze this image and provide a title and detailed description.';
  }

  const openrouter = createOpenRouterProvider(runtime);

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    },
  ];

  try {
    const model = openrouter.chat(modelName);

    const { text: responseText } = await generateText({
      model: model,
      prompt: JSON.stringify(messages),
      maxTokens: maxTokens,
    });

    // Try to parse the response as JSON first
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error analyzing image: ${message}`);
    return {
      title: 'Failed to analyze image',
      description: `Error: ${message}`,
    };
  }
}