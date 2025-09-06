import {
	ModelType,
	type Plugin,
	type IAgentRuntime,
	type GenerateTextParams,
	type ObjectGenerationParams,
	type ImageDescriptionParams,
	type ImageGenerationParams,
} from "@elizaos/core";
import type { Tool, ToolChoice } from "ai";
import { initializeOpenRouter } from "./init";
import { handleTextSmall, handleTextLarge } from "./models/text";
import { handleObjectSmall, handleObjectLarge } from "./models/object";
import { handleImageDescription, handleImageGeneration } from "./models/image";
import { createImageRoutes } from "./routes/images";

/**
 * Defines the OpenRouter plugin with its name, description, and configuration options.
 * @type {Plugin}
 */
export const openrouterPlugin: Plugin = {
	name: "openrouter",
	description: "OpenRouter plugin",
	routes: createImageRoutes(),
	config: {
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
		OPENROUTER_SMALL_MODEL: process.env.OPENROUTER_SMALL_MODEL,
		OPENROUTER_LARGE_MODEL: process.env.OPENROUTER_LARGE_MODEL,
		OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
		OPENROUTER_IMAGE_GENERATION_MODEL: process.env.OPENROUTER_IMAGE_GENERATION_MODEL,
		OPENROUTER_AUTO_CLEANUP_IMAGES: process.env.OPENROUTER_AUTO_CLEANUP_IMAGES,
		SMALL_MODEL: process.env.SMALL_MODEL,
		LARGE_MODEL: process.env.LARGE_MODEL,
		IMAGE_MODEL: process.env.IMAGE_MODEL,
		IMAGE_GENERATION_MODEL: process.env.IMAGE_GENERATION_MODEL,
	},
	async init(config, runtime) {
		// Note: We intentionally don't await here because ElizaOS expects
		// the init method to return quickly. The initializeOpenRouter function
		// only performs synchronous validation and logging, so it's safe to
		// call without await. This prevents blocking the plugin initialization.
		initializeOpenRouter(config, runtime);
	},
	models: {
		[ModelType.TEXT_SMALL]: async (
			runtime: IAgentRuntime,
			params: GenerateTextParams & {
				tools?: Record<string, Tool>;
				toolChoice?: ToolChoice<Record<string, Tool>>;
			},
		) => {
			return handleTextSmall(runtime, params);
		},
		[ModelType.TEXT_LARGE]: async (
			runtime: IAgentRuntime,
			params: GenerateTextParams & {
				tools?: Record<string, Tool>;
				toolChoice?: ToolChoice<Record<string, Tool>>;
			},
		) => {
			return handleTextLarge(runtime, params);
		},
		[ModelType.OBJECT_SMALL]: async (
			runtime: IAgentRuntime,
			params: ObjectGenerationParams,
		) => {
			return handleObjectSmall(runtime, params);
		},
		[ModelType.OBJECT_LARGE]: async (
			runtime: IAgentRuntime,
			params: ObjectGenerationParams,
		) => {
			return handleObjectLarge(runtime, params);
		},
		[ModelType.IMAGE_DESCRIPTION]: async (
			runtime: IAgentRuntime,
			params: ImageDescriptionParams | string,
		) => {
			return handleImageDescription(runtime, params);
		},
		[ModelType.IMAGE]: async (
			runtime: IAgentRuntime,
			params: ImageGenerationParams,
		) => {
			return handleImageGeneration(runtime, params);
		},
	},
};

export default openrouterPlugin;
