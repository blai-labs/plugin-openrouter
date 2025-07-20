import { describe, test, expect, vi } from "vitest";
import { openrouterPlugin } from "../src/index";

// Create a minimal mock runtime
const createMockRuntime = (env: Record<string, string>) => {
	return {
		getSetting: (key: string) => env[key],
		emitEvent: () => {},
		character: {
			system: "You are a helpful assistant.",
		},
	} as unknown as any;
};

describe("OpenRouter Plugin Configuration", () => {
	test("should warn when API key is missing", async () => {
		// Create a mock runtime with no API key
		const mockRuntime = createMockRuntime({});

		// Spy on console warnings
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// Initialize plugin
		if (openrouterPlugin.init) {
			await openrouterPlugin.init({}, mockRuntime);
		}

		// Check that warning was logged
		expect(warnSpy).toHaveBeenCalled();

		// Restore mock
		warnSpy.mockRestore();
	});

	test("should initialize properly with valid API key", async () => {
		// Skip if no API key available for testing
		if (!process.env.OPENROUTER_API_KEY) {
			console.warn("Skipping test: OPENROUTER_API_KEY not set");
			return;
		}

		// Create a mock runtime with API key
		const mockRuntime = createMockRuntime({
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		});

		// Spy on logger
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		// Initialize plugin
		if (openrouterPlugin.init) {
			await openrouterPlugin.init({}, mockRuntime);
		}

		// Give time for API key validation
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Expect no errors during initialization
		expect(logSpy).toHaveBeenCalled();

		// Restore mock
		logSpy.mockRestore();
	});

	test("should use custom image model when configured", () => {
		// Create a mock runtime with custom model settings
		const customImageModel = "anthropic/claude-3-opus-vision";
		const mockRuntime = createMockRuntime({
			OPENROUTER_IMAGE_MODEL: customImageModel,
		});

		// Create spy to access private function
		const getSpy = vi.spyOn(mockRuntime, "getSetting");

		// Check if our model is used
		if (
			openrouterPlugin.models &&
			openrouterPlugin.models["IMAGE_DESCRIPTION"]
		) {
			const imageDescHandler = openrouterPlugin.models["IMAGE_DESCRIPTION"];

			// Just initiating the handler should call getSetting with OPENROUTER_IMAGE_MODEL
			try {
				imageDescHandler(mockRuntime, "https://example.com/image.jpg");
			} catch (err) {
				// We expect an error since we're not making a real API call
				// We just want to verify getSetting was called
			}

			// Verify getSetting was called with OPENROUTER_IMAGE_MODEL
			expect(getSpy).toHaveBeenCalledWith("OPENROUTER_IMAGE_MODEL");
		}
	});
});
