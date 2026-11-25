export const ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE = 4 * 1024 * 1024;

export const ADDITIONAL_OUTPUT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ADDITIONAL_OUTPUT_IMAGE_UPLOAD_ERROR_CODES = [
  "ADDITIONAL_OUTPUT_IMAGE_TOO_LARGE",
  "ADDITIONAL_OUTPUT_IMAGE_INVALID",
  "ADDITIONAL_OUTPUT_IMAGE_UPLOAD_FAILED",
] as const;

export const ADDITIONAL_OUTPUT_IMAGE_SAVE_ERROR_CODES = [
  "ADDITIONAL_OUTPUT_IMAGE_UNAVAILABLE",
] as const;

const UUID_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const ADDITIONAL_OUTPUT_IMAGE_PATH_PATTERN = new RegExp(
  `^${UUID_SEGMENT}/${UUID_SEGMENT}/${UUID_SEGMENT}/${UUID_SEGMENT}$`
);
