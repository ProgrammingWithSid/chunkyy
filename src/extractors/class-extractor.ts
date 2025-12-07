import { ASTNode, Chunk, ChunkType, ParserAdapter } from '../types';
import { BaseExtractor } from './base-extractor';
import { MethodExtractor } from './method-extractor';
import { FunctionExtractor } from './function-extractor';

/**
 * Extracts class declarations
 */
export class ClassExtractor extends BaseExtractor {
  private methodExtractor: MethodExtractor;
  private functionExtractor: FunctionExtractor;

  constructor(adapter: ParserAdapter) {
    super(adapter);
    this.methodExtractor = new MethodExtractor(adapter);
    this.functionExtractor = new FunctionExtractor(adapter);
  }

  canHandle(node: ASTNode): boolean {
    return this.adapter.isClass(node);
  }

  getChunkType(): ChunkType {
    return 'class';
  }

  extract(
    node: ASTNode,
    sourceCode: string,
    filePath: string,
    parentQualifiedName?: string
  ): Chunk[] {
    const name = this.adapter.getNodeName(node);
    if (!name) {
      return [];
    }

    const qualifiedName = parentQualifiedName
      ? `${parentQualifiedName}.${name}`
      : name;

    const chunk = this.createChunk(
      node,
      sourceCode,
      filePath,
      name,
      qualifiedName,
      'class',
      parentQualifiedName
    );

    // Extract methods and nested classes
    const nested = this.extractNested(
      node,
      sourceCode,
      filePath,
      qualifiedName,
      [this.methodExtractor, this.functionExtractor]
    );

    // Update chunk with children
    chunk.childrenIds = nested.map(c => c.id);

    return [chunk, ...nested];
  }
}
