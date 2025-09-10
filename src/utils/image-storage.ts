import { existsSync, unlinkSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger, getGeneratedDir } from "@elizaos/core";

/**
 * Save base64 image to disk and return the file path
 */
export async function saveBase64Image(base64Url: string, agentId: string, index: number = 0): Promise<string | null> {
	// Extract base64 data and extension with MIME type validation
	const m = base64Url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
	if (!m) return null;
	
	const mime = m[1];
	const base64Data = m[2];
	
	// Whitelist of allowed MIME types mapped to extensions
	const extMap: Record<string, string> = {
		"image/png": "png",
		"image/jpeg": "jpg",
		"image/jpg": "jpg",
		"image/webp": "webp",
		"image/gif": "gif",
		"image/bmp": "bmp",
		"image/tiff": "tiff"
	};
	
	const extension = extMap[mime];
	if (!extension) return null;

	// Use ElizaOS convention: .eliza/data/generated/{agentId}/
	const baseDir = join(getGeneratedDir(), agentId);
	
	// Create directory if it doesn't exist
	if (!existsSync(baseDir)) {
		await mkdir(baseDir, { recursive: true });
	}

	// Generate filename with timestamp
	const timestamp = Date.now();
	const filename = `image_${timestamp}_${index}.${extension}`;
	const filepath = join(baseDir, filename);

	// Save image to disk
	const buffer = Buffer.from(base64Data, "base64");
	await writeFile(filepath, buffer);

	logger.info(`[OpenRouter] Saved generated image to ${filepath}`);

	// Return only the file path for Discord/Telegram to read
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