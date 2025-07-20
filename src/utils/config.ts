import type { IAgentRuntime } from "@elizaos/core";

/**
 * Retrieves a configuration setting from the runtime, falling back to environment variables or a default value if not found.
 *
 * @param key - The name of the setting to retrieve.
 * @param defaultValue - The value to return if the setting is not found in the runtime or environment.
 * @returns The resolved setting value, or {@link defaultValue} if not found.
 */
export function getSetting(
	runtime: IAgentRuntime,
	key: string,
	defaultValue?: string,
): string | undefined {
	return runtime.getSetting(key) ?? process.env[key] ?? defaultValue;
}

/**
 * Retrieves the OpenRouter API base URL from runtime settings, environment variables, or defaults.
 *
 * @returns The resolved base URL for OpenRouter API requests.
 */
export function getBaseURL(runtime: IAgentRuntime): string {
	return (
		getSetting(
			runtime,
			"OPENROUTER_BASE_URL",
			"https://openrouter.ai/api/v1",
		) || "https://openrouter.ai/api/v1"
	);
}

/**
 * Helper function to get the API key for OpenRouter
 *
 * @param runtime The runtime context
 * @returns The configured API key
 */
export function getApiKey(runtime: IAgentRuntime): string | undefined {
	return getSetting(runtime, "OPENROUTER_API_KEY");
}

/**
 * Helper function to get the small model name with fallbacks
 *
 * @param runtime The runtime context
 * @returns The configured small model name
 */
export function getSmallModel(runtime: IAgentRuntime): string {
	return (
		getSetting(runtime, "OPENROUTER_SMALL_MODEL") ??
		getSetting(runtime, "SMALL_MODEL", "google/gemini-2.0-flash-001") ??
		"google/gemini-2.0-flash-001"
	);
}

/**
 * Helper function to get the large model name with fallbacks
 *
 * @param runtime The runtime context
 * @returns The configured large model name
 */
export function getLargeModel(runtime: IAgentRuntime): string {
	return (
		getSetting(runtime, "OPENROUTER_LARGE_MODEL") ??
		getSetting(
			runtime,
			"LARGE_MODEL",
			"google/gemini-2.5-flash-preview-05-20",
		) ??
		"google/gemini-2.5-flash-preview-05-20"
	);
}

/**
 * Helper function to get the image model name with fallbacks
 *
 * @param runtime The runtime context
 * @returns The configured image model name
 */
export function getImageModel(runtime: IAgentRuntime): string {
	return (
		getSetting(runtime, "OPENROUTER_IMAGE_MODEL") ??
		getSetting(runtime, "IMAGE_MODEL", "x-ai/grok-2-vision-1212") ??
		"x-ai/grok-2-vision-1212"
	);
}
