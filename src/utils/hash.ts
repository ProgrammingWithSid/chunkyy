import { createHash } from 'crypto';

/**
 * Generate a stable hash for chunk content
 */
export function generateChunkHash(
  content: string,
  filePath: string,
  range: { startLine: number; endLine: number }
): string {
  const hashInput = `${filePath}:${range.startLine}:${range.endLine}:${content}`;
  return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

/**
 * Generate a stable chunk ID based on file path and qualified name
 */
export function generateChunkId(filePath: string, qualifiedName: string, type: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const idInput = `${normalizedPath}:${type}:${qualifiedName}`;
  return createHash('sha256').update(idInput).digest('hex').substring(0, 16);
}
