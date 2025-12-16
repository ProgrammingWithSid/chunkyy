import { createParser } from '../parsers';
import { ParserAdapter, ParserType } from '../types';

/**
 * Parser pool for reusing parser instances
 * Reduces overhead of creating new parsers for each file
 */
export class ParserPool {
  private pools: Map<string, ParserAdapter[]> = new Map();
  private maxPoolSize: number;
  private stats = {
    created: 0,
    reused: 0,
    released: 0,
  };

  constructor(maxPoolSize: number = 5) {
    this.maxPoolSize = maxPoolSize;
  }

  /**
   * Get a parser adapter from the pool or create a new one
   */
  getAdapter(parserType: ParserType, filePath?: string): ParserAdapter {
    const poolKey = this.getPoolKey(parserType, filePath);
    const pool = this.pools.get(poolKey) || [];

    // Reuse existing adapter if available
    if (pool.length > 0) {
      const adapter = pool.pop()!;
      this.stats.reused++;
      this.pools.set(poolKey, pool);
      return adapter;
    }

    // Create new adapter
    const adapter = createParser(parserType, filePath);
    this.stats.created++;
    return adapter;
  }

  /**
   * Release an adapter back to the pool
   */
  releaseAdapter(parserType: ParserType, adapter: ParserAdapter, filePath?: string): void {
    const poolKey = this.getPoolKey(parserType, filePath);
    const pool = this.pools.get(poolKey) || [];

    // Only add to pool if under max size
    if (pool.length < this.maxPoolSize) {
      pool.push(adapter);
      this.pools.set(poolKey, pool);
      this.stats.released++;
    }
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.pools.clear();
    this.stats = { created: 0, reused: 0, released: 0 };
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      hitRate:
        this.stats.created + this.stats.reused > 0
          ? this.stats.reused / (this.stats.created + this.stats.reused)
          : 0,
      poolSizes: Array.from(this.pools.entries()).map(([key, pool]) => ({
        key,
        size: pool.length,
      })),
    };
  }

  /**
   * Generate pool key from parser type and file path
   */
  private getPoolKey(parserType: ParserType, filePath?: string): string {
    // For tree-sitter, include language in key
    if (parserType === 'treesitter' && filePath) {
      // Extract language from file extension
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      return `${parserType}:${ext}`;
    }
    return parserType;
  }
}
