import { type Route, logger } from "@elizaos/core";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Request, Response } from "express";
import { IMAGES_DIR, IMAGES_URL_PREFIX } from "../utils/constants";

/**
 * Creates routes for serving generated images
 */
export function createImageRoutes(): Route[] {
	return [
		{
			type: "GET",
			path: `${IMAGES_URL_PREFIX}/*`,
			handler: async (req: Request, res: Response) => {
				try {
					// Extract filename from the path
					const pathParts = req.path.split('/');
					const filename = pathParts[pathParts.length - 1];
					
					// Security: prevent directory traversal
					if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
						res.status(400).json({ error: "Invalid filename" });
						return;
					}
					
					const filepath = join(IMAGES_DIR, filename);
					
					// Check if file exists
					if (!existsSync(filepath)) {
						logger.debug(`[OpenRouter] Image not found: ${filepath}`);
						res.status(404).json({ error: "Image not found" });
						return;
					}
					
					// Determine content type based on extension
					const ext = filename.split(".").pop()?.toLowerCase();
					const contentTypes: Record<string, string> = {
						jpg: "image/jpeg",
						jpeg: "image/jpeg",
						gif: "image/gif",
						webp: "image/webp",
						png: "image/png",
					};
					const contentType = contentTypes[ext || ""] || "image/png";
					
					// Read and send the image
					const image = readFileSync(filepath);
					res.setHeader("Content-Type", contentType);
					res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
					res.send(image);
					
					logger.debug(`[OpenRouter] Served image: ${filename}`);
				} catch (error) {
					logger.error("[OpenRouter] Error serving image:", String(error));
					res.status(500).json({ error: "Internal server error" });
				}
			},
		},
	];
}