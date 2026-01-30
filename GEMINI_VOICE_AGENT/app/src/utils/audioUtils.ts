/**
 * Audio utility functions for backend processing.
 * Uses native Buffer for base64 encode/decode (no extra object creation in hot paths).
 */

/**
 * Converts a base64 string to a Uint8Array using native Buffer.
 */
export function decodeBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Converts a Uint8Array (or Buffer) to base64 string using native Buffer.
 */
export function encodeBase64(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Validates audio data format for realtime ingestion.
 */
export function validateAudioData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.data || typeof data.data !== 'string') return false;
  if (!data.mimeType || !data.mimeType.includes('audio')) return false;
  return true;
}
