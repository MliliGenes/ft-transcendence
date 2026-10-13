export const IMAGE_SETTINGS = {
  AVATAR: { maxBytes: 1024 * 1024, width: 256, height: 256 },
  BANNER: { maxBytes: 5 * 1024 * 1024, width: 1500, height: 500 },
} as const;

export const MAX_IMAGE_PIXELS = 20_000_000;

// Multer buffers the single uploaded file in memory; only its bytes are needed.
export type UploadedImage = { buffer: Buffer };
