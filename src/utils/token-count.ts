/**
 * Approximate token counting for chunks
 * Uses a simple heuristic: ~4 characters per token
 */

export function estimateTokenCount(code: string): number {
  // Simple heuristic: average token is ~4 characters
  // This is a rough approximation; for production, consider using tiktoken or similar
  return Math.ceil(code.length / 4);
}

/**
 * Split code into approximate tokens for size estimation
 */
export function splitIntoTokens(code: string): string[] {
  // Simple tokenization: split by whitespace and punctuation
  return code
    .split(/\s+|([{}();,.\-+*/=<>!&|])/g)
    .filter((token) => token && token.trim().length > 0);
}
