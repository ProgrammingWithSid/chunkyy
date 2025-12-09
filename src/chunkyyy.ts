import fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';
import { Chunker } from './core/chunker';
import {
  Chunk,
  ChunkingOptions,
  ChunkingResult,
  CodeExtractionResult,
  FileRangeRequest,
} from './types';

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
  async chunkDirectory(
    dirPath: string,
    options: { recursive?: boolean } = {}
  ): Promise<ChunkingResult> {
    const fullPath = path.resolve(dirPath);
    const patterns = options.recursive
      ? ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue']
      : ['*.ts', '*.tsx', '*.js', '*.jsx', '*.vue'];

    const ignorePatterns = [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      '**/yarn.lock',
      ...(this.chunker.options.exclude || []),
    ];

    const files = await fg(patterns, {
      cwd: fullPath,
      ignore: ignorePatterns,
      absolute: true,
    });

    const relativeFiles = files.map((f) => path.relative(this.chunker.options.rootDir, f));
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

  /**
   * Extract code chunks with dependencies for specified file ranges
   * Returns complete functions, variables, and all their dependencies
   *
   * @example
   * ```typescript
   * const result = await chunkyyy.extractCodeWithDependencies([
   *   {
   *     filePath: 'src/utils.ts',
   *     ranges: [{ start: 10, end: 25 }, { start: 30, end: 45 }]
   *   },
   *   {
   *     filePath: 'src/api.ts',
   *     ranges: [{ start: 5, end: 20 }]
   *   }
   * ]);
   *
   * // Get code blocks by file
   * result.codeBlocks.get('src/utils.ts'); // Complete code with dependencies
   * ```
   */
  async extractCodeWithDependencies(requests: FileRangeRequest[]): Promise<CodeExtractionResult> {
    return this.chunker.extractCodeWithDependencies(requests);
  }
}
