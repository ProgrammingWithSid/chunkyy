import { ASTNode, Chunk, ChunkType, ParserAdapter } from '../types';
import { generateChunkId, generateChunkHash } from '../utils/hash';
import { estimateTokenCount } from '../utils/token-count';

/**
 * Base class for chunk extractors
 */
export abstract class BaseExtractor {
  constructor(protected adapter: ParserAdapter) {}

  /**
   * Extract chunks from an AST node
   */
  abstract extract(node: ASTNode, sourceCode: string, filePath: string, parentQualifiedName?: string): Chunk[];

  /**
   * Check if this extractor can handle the given node
   */
  abstract canHandle(node: ASTNode): boolean;

  /**
   * Get the chunk type this extractor produces
   */
  abstract getChunkType(): ChunkType;

  /**
   * Create a chunk from an AST node
   */
  protected createChunk(
    node: ASTNode,
    sourceCode: string,
    filePath: string,
    name: string,
    qualifiedName: string,
    type: ChunkType,
    parentQualifiedName?: string
  ): Chunk {
    const range = this.adapter.getNodeRange(node);
    if (!range) {
      throw new Error('Cannot create chunk without range');
    }

    const content = this.adapter.extractCode(node, sourceCode);
    const hash = generateChunkHash(content, filePath, {
      startLine: range.start.line,
      endLine: range.end.line,
    });

    const chunkId = generateChunkId(filePath, qualifiedName, type);
    const parentId = parentQualifiedName
      ? generateChunkId(filePath, parentQualifiedName, 'class')
      : undefined;

    const chunk: Chunk = {
      id: chunkId,
      type,
      name,
      qualifiedName,
      filePath,
      range,
      startLine: range.start.line,
      endLine: range.end.line,
      hash,
      dependencies: this.adapter.getImports(node),
      parentId,
      childrenIds: [],
      exported: this.adapter.isExported(node),
      exportName: this.adapter.getExportName(node),
      decorators: this.adapter.getDecorators(node),
      typeParameters: this.adapter.getTypeParameters(node),
      parameters: this.adapter.getParameters(node),
      returnType: this.adapter.getReturnType(node),
      jsdoc: this.adapter.getJSDoc(node),
      tokenCount: estimateTokenCount(content),
      content,
    };

    return chunk;
  }

  /**
   * Extract nested chunks (e.g., methods from classes)
   */
  protected extractNested(
    node: ASTNode,
    sourceCode: string,
    filePath: string,
    qualifiedName: string,
    extractors: BaseExtractor[]
  ): Chunk[] {
    const nested: Chunk[] = [];
    const children = this.adapter.getChildren(node);

    for (const child of children) {
      // Skip nodes without ranges (decorators, modifiers, etc.)
      const childRange = this.adapter.getNodeRange(child);
      if (!childRange) {
        continue;
      }

      for (const extractor of extractors) {
        if (extractor.canHandle(child)) {
          try {
            const childChunks = extractor.extract(child, sourceCode, filePath, qualifiedName);
            nested.push(...childChunks);
          } catch (error) {
            // Skip chunks that can't be extracted (e.g., methods without proper ranges)
            // This can happen with complex nested structures
            if (error instanceof Error && error.message.includes('range')) {
              continue;
            }
            throw error;
          }
        }
      }
    }

    return nested;
  }
}
