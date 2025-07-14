import { ModelType, type Plugin, type IAgentRuntime, type GenerateTextParams, type ObjectGenerationParams, type ImageDescriptionParams } from '@elizaos/core';
import type { Tool, ToolChoice } from 'ai';
import { initializeOpenRouter } from './init';
import { handleTextSmall, handleTextLarge } from './models/text';
import { handleObjectSmall, handleObjectLarge } from './models/object';
import { handleImageDescription } from './models/image';

/**
 * Defines the OpenRouter plugin with its name, description, and configuration options.
 * @type {Plugin}
 */
export const openrouterPlugin: Plugin = {
  name: 'openrouter',
  description: 'OpenRouter plugin',
  config: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    OPENROUTER_SMALL_MODEL: process.env.OPENROUTER_SMALL_MODEL,
    OPENROUTER_LARGE_MODEL: process.env.OPENROUTER_LARGE_MODEL,
    OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
    SMALL_MODEL: process.env.SMALL_MODEL,
    LARGE_MODEL: process.env.LARGE_MODEL,
    IMAGE_MODEL: process.env.IMAGE_MODEL,
  },
  async init(config, runtime) {
    initializeOpenRouter(config, runtime);
  },
  models: {
    [ModelType.TEXT_SMALL]: async (
      runtime: IAgentRuntime,
      params: GenerateTextParams & {
        tools?: Record<string, Tool>;
        toolChoice?: ToolChoice<Record<string, Tool>>;
      }
    ) => {
      return handleTextSmall(runtime, params);
    },
    [ModelType.TEXT_LARGE]: async (
      runtime: IAgentRuntime,
      params: GenerateTextParams & {
        tools?: Record<string, Tool>;
        toolChoice?: ToolChoice<Record<string, Tool>>;
      }
    ) => {
      return handleTextLarge(runtime, params);
    },
    [ModelType.OBJECT_SMALL]: async (runtime: IAgentRuntime, params: ObjectGenerationParams) => {
      return handleObjectSmall(runtime, params);
    },
    [ModelType.OBJECT_LARGE]: async (runtime: IAgentRuntime, params: ObjectGenerationParams) => {
      return handleObjectLarge(runtime, params);
    },
    [ModelType.IMAGE_DESCRIPTION]: async (
      runtime: IAgentRuntime,
      params: ImageDescriptionParams | string
    ) => {
      return handleImageDescription(runtime, params);
    },
  },
};

export default openrouterPlugin;