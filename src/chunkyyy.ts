import fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';
import { Chunker } from './core/chunker';
import { Chunk, ChunkingOptions, ChunkingResult } from './types';

/**
 * Main Chunkyyy class - high-level API
 */
export class Chunkyyy {
  public chunker: Chunker;
  private cache: Map<string, { chunks: Chunk[]; hash: string }> = new Map();

  constructor(options: ChunkingOptions = {}) {
    this.chunker = new Chunker(options);
  }

  /**
   * Chunk a single file
   */
  async chunkFile(filePath: string): Promise<Chunk[]> {
    // Check cache
    const cached = this.cache.get(filePath);
    if (cached) {
      const currentHash = this.getFileHash(filePath);
      if (currentHash === cached.hash) {
        return cached.chunks;
      }
    }

    const chunks = await this.chunker.chunkFile(filePath);
    const hash = this.getFileHash(filePath);
    this.cache.set(filePath, { chunks, hash });

    return chunks;
  }

  /**
   * Chunk code from a string
   */
  chunkCode(code: string, filePath: string): Chunk[] {
    return this.chunker.chunkCode(code, filePath);
  }

  /**
   * Chunk a directory
   */
  async chunkDirectory(dirPath: string, options: { recursive?: boolean } = {}): Promise<ChunkingResult> {
    const fullPath = path.resolve(dirPath);
    const patterns = options.recursive ? ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'] : ['*.ts', '*.tsx', '*.js', '*.jsx'];

    const files = await fg(patterns, {
      cwd: fullPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
      absolute: true,
    });

    const relativeFiles = files.map(f => path.relative(this.chunker.options.rootDir, f));
    return this.chunker.chunkFiles(relativeFiles);
  }

  /**
   * Clear cache for a file or all files
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.cache.delete(filePath);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get file hash for change detection
   */
  private getFileHash(filePath: string): string {
    try {
      const fullPath = path.resolve(this.chunker.options.rootDir, filePath);
      const stats = fs.statSync(fullPath);
      return `${stats.mtime.getTime()}-${stats.size}`;
    } catch {
      // File doesn't exist or can't be accessed
      return '';
    }
  }

  /**
   * Watch directory for changes and re-chunk incrementally
   */
  watchDirectory(
    _dirPath: string,
    _callback: (filePath: string, chunks: Chunk[]) => void
  ): () => void {
    // This would use chokidar in production
    // For now, return a no-op cleanup function
    void _dirPath;
    void _callback;
    return () => {};
  }
}
