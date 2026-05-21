// Small, dependency-free request-validation helpers shared across routes.

export const MAX_TEXT_LEN = 2000;
// Cap decoded image size to keep AI vision calls (and memory) bounded.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Cap the synced state blob so a single client can't push an unbounded payload.
export const MAX_STATE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Approximate the decoded byte length of a base64 string without allocating a Buffer.
export function approxBase64Bytes(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}
