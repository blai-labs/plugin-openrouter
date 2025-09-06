import { type Route, logger } from "@elizaos/core";
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
					
					// Validate filename
					if (!filename || filename.trim() === '') {
						res.status(400).json({ error: "Filename is required" });
						return;
					}
					
					// Security: strict filename validation (alphanumeric, dash, underscore, dot only)
					const validFilenameRegex = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/;
					if (!validFilenameRegex.test(filename)) {
						res.status(400).json({ error: "Invalid filename format" });
						return;
					}
					
					const filepath = join(IMAGES_DIR, filename);
					
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
					
					// Use sendFile for async operation with built-in security
					const options = {
						headers: {
							"Content-Type": contentType,
							"Cache-Control": "public, max-age=3600", // Cache for 1 hour
						},
					};
					
					res.sendFile(filepath, options, (err) => {
						if (err) {
							if (err.message?.includes("ENOENT")) {
								logger.debug(`[OpenRouter] Image not found: ${filepath}`);
								res.status(404).json({ error: "Image not found" });
							} else {
								logger.error("[OpenRouter] Error serving image:", String(err));
								res.status(500).json({ error: "Failed to serve image" });
							}
						} else {
							logger.debug(`[OpenRouter] Served image: ${filename}`);
						}
					});
				} catch (error) {
					logger.error("[OpenRouter] Error serving image:", String(error));
					res.status(500).json({ error: "Internal server error" });
				}
			},
		},
	];
}