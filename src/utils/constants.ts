import { join } from "node:path";

/**
 * Directory name for generated images
 */
export const IMAGES_DIR_NAME = "generated-images";

/**
 * Full path to the images directory
 */
export const IMAGES_DIR = join(process.cwd(), IMAGES_DIR_NAME);

/**
 * URL path prefix for serving images
 */
export const IMAGES_URL_PREFIX = `/${IMAGES_DIR_NAME}`;