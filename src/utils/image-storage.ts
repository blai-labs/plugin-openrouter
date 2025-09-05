import { existsSync, unlinkSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@elizaos/core";

const IMAGES_DIR = join(process.cwd(), "generated-images");

/**
 * Save base64 image to disk and return the file path
 */
export async function saveBase64Image(base64Url: string, index: number = 0): Promise<string | null> {
	// Extract base64 data and extension
	const matches = base64Url.match(/^data:image\/(\w+);base64,(.+)$/);
	if (!matches) {
		return null;
	}

	const extension = matches[1];
	const base64Data = matches[2];

	// Create images directory if it doesn't exist
	if (!existsSync(IMAGES_DIR)) {
		await mkdir(IMAGES_DIR, { recursive: true });
	}

	// Generate filename with timestamp
	const timestamp = Date.now();
	const filename = `image_${timestamp}_${index}.${extension}`;
	const filepath = join(IMAGES_DIR, filename);

	// Save image to disk
	const buffer = Buffer.from(base64Data, "base64");
	await writeFile(filepath, buffer);

	logger.info(`[OpenRouter] Saved generated image to ${filepath}`);
	return filepath;
}

/**
 * Delete a specific image file
 */
export function deleteImage(filepath: string): void {
	try {
		if (existsSync(filepath)) {
			unlinkSync(filepath);
			logger.debug(`[OpenRouter] Deleted image: ${filepath}`);
		}
	} catch (error) {
		logger.warn(`[OpenRouter] Failed to delete image ${filepath}:`, String(error));
	}
}