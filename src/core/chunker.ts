import * as fs from 'fs';
import * as path from 'path';
import {
  BaseExtractor,
  ClassExtractor,
  EnumExtractor,
  FunctionExtractor,
  InterfaceExtractor,
  NamespaceExtractor,
  TypeAliasExtractor,
  VariableExtractor,
  VueOptionsExtractor,
} from '../extractors';
import { createParser } from '../parsers';
import {
  Chunk,
  ChunkingOptions,
  ChunkingResult,
  ChunkType,
  CodeExtractionResult,
  Dependency,
  DependencyGraph,
  ExportInfo,
  FileRangeRequest,
  ImportExportMap,
  ImportInfo,
  ParserAdapter,
} from '../types';
import { ASTCache } from '../utils/ast-cache';
import { ParserPool } from '../utils/parser-pool';
import { estimateTokenCount } from '../utils/token-count';

/**
 * Main chunking service
 */
export class Chunker {
  private extractors: BaseExtractor[];
  public options: Required<ChunkingOptions>;
  private parserPool: ParserPool;
  private astCache: ASTCache;

  constructor(options: ChunkingOptions = {}) {
    this.options = {
      // Default to 'typescript' for TS/JS, but auto-detect will use tree-sitter for other languages
      parser: options.parser || 'typescript',
      chunkSize: options.chunkSize || 512,
      overlap: options.overlap || 50,
      includeNested: options.includeNested ?? true,
      mergeSmallChunks: options.mergeSmallChunks ?? true,
      minChunkSize: options.minChunkSize || 50,
      rootDir: options.rootDir || process.cwd(),
      include: options.include || ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],
      exclude: options.exclude || [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/package-lock.json',
        '**/pnpm-lock.yaml',
        '**/yarn.lock',
      ],
      includeContent: options.includeContent ?? false, // Default to false for memory efficiency
      parserPoolSize: options.parserPoolSize || 5,
      astCacheTTL: options.astCacheTTL || 5 * 60 * 1000, // 5 minutes
      astCacheMaxSize: options.astCacheMaxSize || 1000,
    };

    // Initialize parser pool and AST cache
    this.parserPool = new ParserPool(options.parserPoolSize || 5);
    this.astCache = new ASTCache(
      options.astCacheTTL || 5 * 60 * 1000, // 5 minutes default
      options.astCacheMaxSize || 1000
    );

    // Extractors will get adapter per-file
    // Create a temporary adapter to initialize extractors
    const tempAdapter = createParser(this.options.parser);
    this.extractors = [
      new VueOptionsExtractor(tempAdapter, this.options.includeContent), // Handle Vue files first
      new ClassExtractor(tempAdapter, this.options.includeContent),
      new InterfaceExtractor(tempAdapter, this.options.includeContent),
      new EnumExtractor(tempAdapter, this.options.includeContent),
      new TypeAliasExtractor(tempAdapter, this.options.includeContent),
      new NamespaceExtractor(tempAdapter, this.options.includeContent),
      new VariableExtractor(tempAdapter, this.options.includeContent), // Before FunctionExtractor to handle arrow functions
      new FunctionExtractor(tempAdapter, this.options.includeContent),
    ];
  }

  /**
   * Set adapter based on file type (using parser pool)
   */
  private getAdapter(filePath: string): ParserAdapter {
    return this.parserPool.getAdapter(this.options.parser, filePath);
  }

  /**
   * Release adapter back to pool
   */
  private releaseAdapter(filePath: string, adapter: ParserAdapter): void {
    this.parserPool.releaseAdapter(this.options.parser, adapter, filePath);
  }

  /**
   * Update adapters for all extractors, including nested ones
   */
  private updateExtractorAdapters(adapter: ParserAdapter): void {
    this.extractors.forEach((extractor) => {
      // All extractors extend BaseExtractor which has protected adapter
      // Use Object.defineProperty to update protected property
      Object.defineProperty(extractor, 'adapter', {
        value: adapter,
        writable: true,
        configurable: true,
      });

      // Update nested extractors in ClassExtractor
      // Note: ClassExtractor's nested extractors are updated when ClassExtractor is constructed
      // They receive the adapter at construction time, so no manual update needed here
      // If adapter changes, ClassExtractor would need to be recreated
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

      // Check AST cache first
      const contentHash = ASTCache.generateContentHash(sourceCode);
      let ast = this.astCache.get(filePath, contentHash);

      if (!ast) {
        // Parse if not in cache
        ast = adapter.parse(sourceCode, filePath);
        // Cache the AST
        this.astCache.set(filePath, contentHash, ast);
      }

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
            extracted.forEach((chunk) => {
              // Merge file imports with chunk-specific imports
              const existingSources = new Set(chunk.dependencies.map((d) => d.source));
              fileImports.forEach((imp) => {
                if (!existingSources.has(imp.source)) {
                  chunk.dependencies.push(imp);
                }
              });
            });
            chunks.push(...extracted);
            // Break after first matching extractor to avoid duplicate extraction
            break;
          }
        }
      }

      // Post-process chunks
      const result = this.postProcessChunks(chunks, sourceCode);

      // Release adapter back to pool
      this.releaseAdapter(filePath, adapter);

      return result;
    } catch (error) {
      // Silently return empty array on error (library should not log by default)
      // Users can catch errors from chunkFile if needed
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
      // Calculate size - use tokenCount if available, otherwise estimate from content or range
      const size =
        chunk.tokenCount ||
        (chunk.content ? estimateTokenCount(chunk.content) : this.estimateSizeFromRange(chunk));

      // Don't merge certain chunk types - they should remain separate
      // Methods, functions, classes, interfaces, enums, type aliases, namespaces, and Vue options should not be merged
      const shouldNotMerge = [
        'method',
        'function',
        'class',
        'interface',
        'enum',
        'type-alias',
        'namespace',
        'top-level-declaration', // Used for Vue props, emits, etc.
      ].includes(chunk.type);

      if (size < this.options.minChunkSize && currentChunk && !shouldNotMerge) {
        // Merge with previous chunk if both are small (but not methods)
        const currentSize =
          currentChunk.tokenCount ||
          (currentChunk.content
            ? estimateTokenCount(currentChunk.content)
            : this.estimateSizeFromRange(currentChunk));
        if (currentSize + size <= this.options.chunkSize) {
          // Merge chunks
          const mergedContent = this.mergeChunkContent(currentChunk, chunk, sourceCode);
          if (this.options.includeContent) {
            currentChunk.content = mergedContent;
          }
          currentChunk.endLine = chunk.endLine;
          currentChunk.range.end = chunk.range.end;
          currentChunk.tokenCount = estimateTokenCount(mergedContent);
          currentChunk.childrenIds.push(...chunk.childrenIds);
          continue;
        }
      }

      if (currentChunk) {
        processed.push(currentChunk);
      }
      currentChunk = chunk;
    }

    if (currentChunk) {
      processed.push(currentChunk);
    }

    return processed;
  }

  /**
   * Estimate token count from range (rough approximation)
   */
  private estimateSizeFromRange(chunk: Chunk): number {
    // Rough estimate: ~4 tokens per line
    const lineCount = chunk.endLine - chunk.startLine + 1;
    return lineCount * 4;
  }

  /**
   * Reconstruct code content for a chunk from its file and range
   * Useful when includeContent is false to get content on-demand
   */
  async getChunkContent(chunk: Chunk): Promise<string> {
    if (chunk.content !== undefined) {
      return chunk.content;
    }

    // Reconstruct from file
    const fullPath = path.resolve(this.options.rootDir, chunk.filePath);
    const sourceCode = fs.readFileSync(fullPath, 'utf-8');
    const lines = sourceCode.split('\n');

    // Extract lines based on range (1-indexed)
    const startLine = chunk.startLine - 1;
    const endLine = chunk.endLine;
    const content = lines.slice(startLine, endLine).join('\n');

    return content;
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
      const matchingChunks = allChunks.filter((c) => {
        return (
          c.filePath.includes(dep.source) && (c.exportName === dep.name || c.name === dep.name)
        );
      });
      resolved.push(...matchingChunks);
    }

    // Strategy 2: Find by export name in same file
    if (resolved.length === 0) {
      const sameFileChunks = allChunks.filter((c) => {
        return (
          c.filePath === fromFilePath &&
          (c.exportName === dep.name || c.name === dep.name) &&
          c.exported
        );
      });
      resolved.push(...sameFileChunks);
    }

    // Strategy 3: Find by name globally (fallback)
    if (resolved.length === 0) {
      const globalMatches = allChunks.filter((c) => {
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
    const dir = path.dirname(fromFilePath);
    const resolved = path.resolve(dir, importPath);

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', ''];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (this.fileExists(withExt)) {
        return withExt;
      }
    }

    // Try index files
    for (const ext of extensions) {
      const indexPath = path.join(resolved, `index${ext}`);
      if (this.fileExists(indexPath)) {
        return indexPath;
      }
    }

    return resolved;
  }

  /**
   * Check if file exists
   */
  private fileExists(filePath: string): boolean {
    try {
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
      totalTokens +=
        chunk.tokenCount ||
        (chunk.content ? estimateTokenCount(chunk.content) : this.estimateSizeFromRange(chunk));
    }

    return {
      totalFiles: fileCount,
      totalChunks: chunks.length,
      chunksByType,
      averageChunkSize: chunks.length > 0 ? totalTokens / chunks.length : 0,
      totalTokens,
    };
  }

  /**
   * Extract code chunks with dependencies for specified file ranges
   * Returns complete functions, variables, and all their dependencies
   */
  async extractCodeWithDependencies(requests: FileRangeRequest[]): Promise<CodeExtractionResult> {
    // Step 1: Chunk all requested files
    const allFileChunks: Chunk[] = [];
    const fileChunkMap = new Map<string, Chunk[]>(); // filePath -> chunks

    for (const request of requests) {
      const chunks = await this.chunkFile(request.filePath);
      fileChunkMap.set(request.filePath, chunks);
      allFileChunks.push(...chunks);
    }

    // Step 2: Find chunks that overlap with specified ranges
    const selectedChunkIds = new Set<string>();
    const selectedChunks: Chunk[] = [];

    for (const request of requests) {
      const fileChunks = fileChunkMap.get(request.filePath) || [];

      for (const range of request.ranges) {
        // Find chunks that overlap with this range
        for (const chunk of fileChunks) {
          const overlaps = this.chunkOverlapsRange(chunk, range);
          if (overlaps && !selectedChunkIds.has(chunk.id)) {
            selectedChunkIds.add(chunk.id);
            selectedChunks.push(chunk);
          }
        }
      }
    }

    // Step 3: Build dependency graph for all chunks
    let dependencyGraph = this.buildDependencyGraph(allFileChunks);

    // Step 4: Resolve all dependencies recursively
    const dependentChunkIds = new Set<string>();
    const resolveDependencies = (chunkId: string, visited: Set<string>): void => {
      if (visited.has(chunkId)) return;
      visited.add(chunkId);

      const dependencies = dependencyGraph[chunkId] || [];
      for (const depId of dependencies) {
        dependentChunkIds.add(depId);
        resolveDependencies(depId, visited);
      }
    };

    // Resolve dependencies for all selected chunks
    for (const chunk of selectedChunks) {
      resolveDependencies(chunk.id, new Set());
    }

    // Step 5: Get all dependent chunks
    const dependentChunks: Chunk[] = [];
    const allChunkMap = new Map<string, Chunk>();
    for (const chunk of allFileChunks) {
      allChunkMap.set(chunk.id, chunk);
    }

    // Step 5b: For same-file dependencies, include only chunks that are actual dependencies
    // This handles cases where functions call other functions in the same file
    const sameFileChunkIds = new Set<string>();
    for (const selectedChunk of selectedChunks) {
      // Only include chunks that are in the dependency graph for this selected chunk
      const dependencies = dependencyGraph[selectedChunk.id] || [];
      for (const depId of dependencies) {
        const depChunk = allChunkMap.get(depId);
        // Only include if it's from the same file and not already selected/dependent
        if (
          depChunk &&
          depChunk.filePath === selectedChunk.filePath &&
          !selectedChunkIds.has(depId) &&
          !dependentChunkIds.has(depId)
        ) {
          sameFileChunkIds.add(depId);
        }
      }
    }

    // Also include chunks from other files that are dependencies
    // We need to chunk all files that might contain dependencies
    const dependencyFiles = new Set<string>();
    const processedChunks = new Set<string>();

    // Recursively collect dependency files from selected chunks and their dependencies
    const collectDependencyFiles = (chunkIds: Set<string>) => {
      for (const chunkId of chunkIds) {
        if (processedChunks.has(chunkId)) continue;
        processedChunks.add(chunkId);

        const chunk = allChunkMap.get(chunkId);
        if (!chunk) continue;

        for (const dep of chunk.dependencies) {
          if (dep.source && dep.source.startsWith('.')) {
            // Relative import - resolve file path
            const resolvedPath = this.resolveRelativePath(dep.source, chunk.filePath);
            if (resolvedPath && !dependencyFiles.has(resolvedPath)) {
              dependencyFiles.add(resolvedPath);
            }
          }
        }

        // Recursively process dependencies
        const depIds = dependencyGraph[chunkId] || [];
        if (depIds.length > 0) {
          collectDependencyFiles(new Set(depIds));
        }
      }
    };

    // Start with selected chunks
    collectDependencyFiles(new Set(selectedChunks.map((c) => c.id)));

    // Chunk dependency files
    for (const depFile of dependencyFiles) {
      try {
        // Check if file exists
        const fullPath = path.resolve(this.options.rootDir, depFile);
        if (!fs.existsSync(fullPath)) {
          continue;
        }

        const depChunks = await this.chunkFile(depFile);
        allFileChunks.push(...depChunks);

        for (const chunk of depChunks) {
          allChunkMap.set(chunk.id, chunk);

          // Check if this chunk matches any dependency name from selected chunks
          for (const selectedChunk of selectedChunks) {
            for (const dep of selectedChunk.dependencies) {
              if (dep.source && dep.source.startsWith('.')) {
                const resolvedPath = this.resolveRelativePath(dep.source, selectedChunk.filePath);
                if (
                  resolvedPath === depFile &&
                  (chunk.name === dep.name || chunk.exportName === dep.name)
                ) {
                  if (!dependentChunkIds.has(chunk.id)) {
                    dependentChunkIds.add(chunk.id);
                  }
                }
              }
            }
          }
        }

        // Rebuild dependency graph with new chunks
        dependencyGraph = this.buildDependencyGraph(allFileChunks);
      } catch (error) {
        // File might not exist or can't be accessed
        continue;
      }
    }

    // Get dependent chunks from already chunked files
    for (const chunkId of dependentChunkIds) {
      const chunk = allChunkMap.get(chunkId);
      if (chunk && !selectedChunkIds.has(chunkId)) {
        dependentChunks.push(chunk);
      }
    }

    // Get same-file chunks
    const sameFileChunks: Chunk[] = [];
    for (const chunkId of sameFileChunkIds) {
      const chunk = allChunkMap.get(chunkId);
      if (chunk) {
        sameFileChunks.push(chunk);
      }
    }

    // Step 6: Build complete code blocks
    const allChunks = [...selectedChunks, ...dependentChunks, ...sameFileChunks];
    const codeBlocks = new Map<string, string>();

    // Group chunks by file and build code blocks
    const chunksByFile = new Map<string, Chunk[]>();
    for (const chunk of allChunks) {
      if (!chunksByFile.has(chunk.filePath)) {
        chunksByFile.set(chunk.filePath, []);
      }
      chunksByFile.get(chunk.filePath)!.push(chunk);
    }

    // Build code blocks for each file
    for (const [filePath, chunks] of chunksByFile.entries()) {
      const fullPath = path.resolve(this.options.rootDir, filePath);
      if (!fs.existsSync(fullPath)) {
        // File might have been deleted or path is incorrect
        // Skip this file silently (library should not log by default)
        continue;
      }
      const sourceCode = fs.readFileSync(fullPath, 'utf-8');
      const lines = sourceCode.split('\n');

      // Sort chunks by start line
      const sortedChunks = [...chunks].sort((a, b) => a.startLine - b.startLine);

      // Extract code for each chunk and combine
      const codeParts: string[] = [];
      let lastEndLine = 0;

      for (const chunk of sortedChunks) {
        // Add any code between chunks (imports, etc.) - but only if gap is small
        // Don't include huge gaps (like template sections in Vue files)
        if (chunk.startLine > lastEndLine + 1) {
          const gapSize = chunk.startLine - lastEndLine - 1;
          // Only include gaps that are small (likely imports/comments between chunks)
          // Large gaps (like 100+ lines) are probably template sections or unrelated code
          if (gapSize > 0 && gapSize <= 20) {
            const gapStart = Math.max(0, lastEndLine);
            const gapEnd = chunk.startLine - 1;
            const gapCode = lines.slice(gapStart, gapEnd).join('\n');
            if (gapCode.trim()) {
              codeParts.push(gapCode);
            }
          }
        }

        // Add chunk code
        const chunkContent = await this.getChunkContent(chunk);
        codeParts.push(chunkContent);

        lastEndLine = Math.max(lastEndLine, chunk.endLine);
      }

      codeBlocks.set(filePath, codeParts.join('\n\n'));
    }

    return {
      selectedChunks,
      dependentChunks,
      allChunks,
      codeBlocks,
      dependencyGraph,
    };
  }

  /**
   * Check if a chunk overlaps with a line range
   */
  private chunkOverlapsRange(chunk: Chunk, range: { start: number; end: number }): boolean {
    // Check if chunk overlaps with range (inclusive boundaries)
    return !(chunk.endLine < range.start || chunk.startLine > range.end);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      parserPool: this.parserPool.getStats(),
      astCache: this.astCache.getStats(),
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.parserPool.clear();
    this.astCache.clear();
  }

  /**
   * Invalidate AST cache for a specific file
   */
  invalidateASTCache(filePath: string): void {
    this.astCache.invalidate(filePath);
  }
}
