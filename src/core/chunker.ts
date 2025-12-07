import * as fs from 'fs';
import * as path from 'path';
import * as pathModule from 'path';
import {
    BaseExtractor,
    ClassExtractor,
    EnumExtractor,
    FunctionExtractor,
    InterfaceExtractor,
} from '../extractors';
import { createParser } from '../parsers';
import { Chunk, ChunkingOptions, ChunkingResult, ChunkType, Dependency, DependencyGraph, ExportInfo, ImportExportMap, ImportInfo, ParserAdapter } from '../types';
import { estimateTokenCount } from '../utils/token-count';

/**
 * Main chunking service
 */
export class Chunker {
  private extractors: BaseExtractor[];
  public options: Required<ChunkingOptions>;

  constructor(options: ChunkingOptions = {}) {
    this.options = {
      parser: options.parser || 'typescript',
      chunkSize: options.chunkSize || 512,
      overlap: options.overlap || 50,
      includeNested: options.includeNested ?? true,
      mergeSmallChunks: options.mergeSmallChunks ?? true,
      minChunkSize: options.minChunkSize || 50,
      rootDir: options.rootDir || process.cwd(),
      include: options.include || ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      exclude: options.exclude || ['node_modules/**', 'dist/**', 'build/**'],
    };

    // Extractors will get adapter per-file
    // Create a temporary adapter to initialize extractors
    const tempAdapter = createParser(this.options.parser);
    this.extractors = [
      new ClassExtractor(tempAdapter),
      new InterfaceExtractor(tempAdapter),
      new EnumExtractor(tempAdapter),
      new FunctionExtractor(tempAdapter),
    ];
  }

  /**
   * Set adapter based on file type
   */
  private getAdapter(filePath: string): ParserAdapter {
    return createParser(this.options.parser, filePath);
  }

  /**
   * Update adapters for all extractors, including nested ones
   */
  private updateExtractorAdapters(adapter: ParserAdapter): void {
    this.extractors.forEach(extractor => {
      (extractor as unknown as { adapter: ParserAdapter }).adapter = adapter;

      // Update nested extractors in ClassExtractor
      if (extractor instanceof ClassExtractor) {
        const classExtractor = extractor as unknown as {
          methodExtractor?: { adapter: ParserAdapter };
          functionExtractor?: { adapter: ParserAdapter };
        };
        if (classExtractor.methodExtractor) {
          classExtractor.methodExtractor.adapter = adapter;
        }
        if (classExtractor.functionExtractor) {
          classExtractor.functionExtractor.adapter = adapter;
        }
      }
    });
  }

  /**
   * Chunk a single file
   */
  async chunkFile(filePath: string): Promise<Chunk[]> {
    const fullPath = path.resolve(this.options.rootDir, filePath);
    const sourceCode = fs.readFileSync(fullPath, 'utf-8');
    return this.chunkCode(sourceCode, filePath);
  }

  /**
   * Chunk code from a string
   */
  chunkCode(sourceCode: string, filePath: string): Chunk[] {
    try {
      const adapter = this.getAdapter(filePath);

      // Update extractors with the adapter (including nested extractors)
      this.updateExtractorAdapters(adapter);

      const ast = adapter.parse(sourceCode, filePath);
      const root = adapter.getRoot(ast);
      const topLevelDecls = adapter.getTopLevelDeclarations(root);

      // Get file-level imports (shared across all chunks)
      const fileImports = adapter.getImports(root);

      const chunks: Chunk[] = [];

      // Use regular extractors for TS/JS files
      for (const decl of topLevelDecls) {
        for (const extractor of this.extractors) {
          if (extractor.canHandle(decl)) {
            const extracted = extractor.extract(decl, sourceCode, filePath);
            // Add file-level imports to each chunk
            extracted.forEach(chunk => {
              // Merge file imports with chunk-specific imports
              const existingSources = new Set(chunk.dependencies.map(d => d.source));
              fileImports.forEach(imp => {
                if (!existingSources.has(imp.source)) {
                  chunk.dependencies.push(imp);
                }
              });
            });
            chunks.push(...extracted);
          }
        }
      }

      // Post-process chunks
      return this.postProcessChunks(chunks, sourceCode);
    } catch (error) {
      console.error(`Error chunking ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Post-process chunks: merge small chunks, handle size limits
   */
  private postProcessChunks(chunks: Chunk[], sourceCode: string): Chunk[] {
    if (!this.options.mergeSmallChunks) {
      return chunks;
    }

    const processed: Chunk[] = [];
    let currentChunk: Chunk | null = null;

    for (const chunk of chunks) {
      const size = chunk.tokenCount || estimateTokenCount(chunk.content);

      // Don't merge method chunks - they should remain separate
      const isMethod = chunk.type === 'method';

      if (size < this.options.minChunkSize && currentChunk && !isMethod) {
        // Merge with previous chunk if both are small (but not methods)
        const currentSize = currentChunk.tokenCount || estimateTokenCount(currentChunk.content);
        if (currentSize + size <= this.options.chunkSize) {
          // Merge chunks
          const mergedContent = this.mergeChunkContent(currentChunk, chunk, sourceCode);
          currentChunk.content = mergedContent;
          currentChunk.endLine = chunk.endLine;
          currentChunk.range.end = chunk.range.end;
          currentChunk.tokenCount = estimateTokenCount(mergedContent);
          currentChunk.childrenIds.push(...chunk.childrenIds);
          continue;
        }
      }

      // Split large chunks if needed
      if (size > this.options.chunkSize) {
        const splitChunks = this.splitLargeChunk(chunk);
        processed.push(...splitChunks);
        currentChunk = null;
      } else {
        if (currentChunk) {
          processed.push(currentChunk);
        }
        currentChunk = chunk;
      }
    }

    if (currentChunk) {
      processed.push(currentChunk);
    }

    return processed;
  }

  /**
   * Merge content from two chunks
   */
  private mergeChunkContent(chunk1: Chunk, chunk2: Chunk, sourceCode: string): string {
    const start = Math.min(chunk1.startLine, chunk2.startLine);
    const end = Math.max(chunk1.endLine, chunk2.endLine);

    // Extract lines from source code
    const lines = sourceCode.split('\n');
    return lines.slice(start - 1, end).join('\n');
  }

  /**
   * Split a large chunk into smaller ones
   */
  private splitLargeChunk(chunk: Chunk): Chunk[] {
    // For now, return as-is. In production, implement AST-aware splitting
    // that respects syntactic boundaries
    return [chunk];
  }

  /**
   * Build dependency graph from chunks with proper import resolution
   */
  buildDependencyGraph(chunks: Chunk[]): DependencyGraph {
    const graph: DependencyGraph = {};
    const chunkMap = new Map<string, Chunk>();
    const exportMap = new Map<string, Map<string, Chunk>>(); // file -> exportName -> chunk

    // Index chunks by ID and build export map
    for (const chunk of chunks) {
      chunkMap.set(chunk.id, chunk);
      graph[chunk.id] = [];

      // Index exports by file and export name
      if (chunk.exported) {
        const fileExports = exportMap.get(chunk.filePath) || new Map();
        const exportName = chunk.exportName || chunk.name;
        fileExports.set(exportName, chunk);
        exportMap.set(chunk.filePath, fileExports);
      }
    }

    // Build graph based on dependencies with proper resolution
    for (const chunk of chunks) {
      const dependencies: string[] = [];

      for (const dep of chunk.dependencies) {
        // Resolve import: try multiple strategies
        const resolvedChunks = this.resolveDependency(dep, chunk.filePath, chunks, exportMap);

        for (const resolved of resolvedChunks) {
          if (!dependencies.includes(resolved.id)) {
            dependencies.push(resolved.id);
          }
        }
      }

      // Also check for parent-child relationships
      if (chunk.parentId && chunkMap.has(chunk.parentId)) {
        if (!dependencies.includes(chunk.parentId)) {
          dependencies.push(chunk.parentId);
        }
      }

      graph[chunk.id] = dependencies;
    }

    return graph;
  }

  /**
   * Resolve a dependency to actual chunks
   */
  private resolveDependency(
    dep: Dependency,
    fromFilePath: string,
    allChunks: Chunk[],
    exportMap: Map<string, Map<string, Chunk>>
  ): Chunk[] {
    const resolved: Chunk[] = [];

    // Strategy 1: Resolve by module path (most accurate)
    if (dep.source && dep.source.startsWith('.')) {
      // Relative import - resolve file path
      const resolvedPath = this.resolveRelativePath(dep.source, fromFilePath);
      const fileExports = exportMap.get(resolvedPath);
      if (fileExports) {
        const exportedChunk = fileExports.get(dep.name);
        if (exportedChunk) {
          resolved.push(exportedChunk);
        }
      }
    } else if (dep.source) {
      // Absolute/package import - find by package name
      const matchingChunks = allChunks.filter(c => {
        return c.filePath.includes(dep.source) &&
               (c.exportName === dep.name || c.name === dep.name);
      });
      resolved.push(...matchingChunks);
    }

    // Strategy 2: Find by export name in same file
    if (resolved.length === 0) {
      const sameFileChunks = allChunks.filter(c => {
        return c.filePath === fromFilePath &&
               (c.exportName === dep.name || c.name === dep.name) &&
               c.exported;
      });
      resolved.push(...sameFileChunks);
    }

    // Strategy 3: Find by name globally (fallback)
    if (resolved.length === 0) {
      const globalMatches = allChunks.filter(c => {
        return (c.exportName === dep.name || c.name === dep.name) && c.exported;
      });
      resolved.push(...globalMatches);
    }

    return resolved;
  }

  /**
   * Resolve relative import path to absolute file path
   */
  private resolveRelativePath(importPath: string, fromFilePath: string): string {
    const dir = pathModule.dirname(fromFilePath);
    const resolved = pathModule.resolve(dir, importPath);

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (this.fileExists(withExt)) {
        return withExt;
      }
    }

    // Try index files
    for (const ext of extensions) {
      const indexPath = pathModule.join(resolved, `index${ext}`);
      if (this.fileExists(indexPath)) {
        return indexPath;
      }
    }

    return resolved;
  }

  /**
   * Check if file exists (simplified - would use fs in production)
   */
  private fileExists(filePath: string): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Build comprehensive import/export map with deduplication and metadata
   */
  buildImportExportMap(chunks: Chunk[]): ImportExportMap {
    const map: ImportExportMap = {
      exports: new Map(),
      imports: new Map(),
    };

    // Track unique imports/exports per file
    const fileExports = new Map<string, Map<string, ExportInfo>>();
    const fileImports = new Map<string, Map<string, ImportInfo>>();

    for (const chunk of chunks) {
      const filePath = chunk.filePath;

      // Add exports with deduplication
      if (chunk.exported) {
        if (!fileExports.has(filePath)) {
          fileExports.set(filePath, new Map());
        }

        const exportName = chunk.exportName || chunk.name;
        const exportKey = `${exportName}:${chunk.type}`;

        if (!fileExports.get(filePath)!.has(exportKey)) {
          fileExports.get(filePath)!.set(exportKey, {
            name: exportName,
            type: chunk.type,
            chunkId: chunk.id,
            default: chunk.exportName === 'default' || exportName === 'default',
          });
        }
      }

      // Add imports with deduplication and enhanced metadata
      if (chunk.dependencies.length > 0) {
        if (!fileImports.has(filePath)) {
          fileImports.set(filePath, new Map());
        }

        for (const dep of chunk.dependencies) {
          const importKey = `${dep.source}:${dep.name}`;

          if (!fileImports.get(filePath)!.has(importKey)) {
            fileImports.get(filePath)!.set(importKey, {
              name: dep.name,
              source: dep.source,
              default: dep.default,
              namespace: dep.namespace,
            });
          }
        }
      }
    }

    // Convert Maps to Arrays
    for (const [filePath, exportsMap] of fileExports) {
      map.exports.set(filePath, Array.from(exportsMap.values()));
    }

    for (const [filePath, importsMap] of fileImports) {
      map.imports.set(filePath, Array.from(importsMap.values()));
    }

    return map;
  }

  /**
   * Chunk multiple files and return full result
   */
  async chunkFiles(filePaths: string[]): Promise<ChunkingResult> {
    const allChunks: Chunk[] = [];

    for (const filePath of filePaths) {
      const chunks = await this.chunkFile(filePath);
      allChunks.push(...chunks);
    }

    const dependencyGraph = this.buildDependencyGraph(allChunks);
    const importExportMap = this.buildImportExportMap(allChunks);

    const stats = this.calculateStats(allChunks, filePaths.length);

    return {
      chunks: allChunks,
      dependencyGraph,
      importExportMap,
      stats,
    };
  }

  /**
   * Calculate chunking statistics
   */
  calculateStats(chunks: Chunk[], fileCount: number) {
    const chunksByType: Record<ChunkType, number> = {
      function: 0,
      class: 0,
      method: 0,
      interface: 0,
      enum: 0,
      'type-alias': 0,
      namespace: 0,
      export: 0,
      'top-level-declaration': 0,
      module: 0,
    };

    let totalTokens = 0;

    for (const chunk of chunks) {
      chunksByType[chunk.type]++;
      totalTokens += chunk.tokenCount || estimateTokenCount(chunk.content);
    }

    return {
      totalFiles: fileCount,
      totalChunks: chunks.length,
      chunksByType,
      averageChunkSize: chunks.length > 0 ? totalTokens / chunks.length : 0,
      totalTokens,
    };
  }
}
