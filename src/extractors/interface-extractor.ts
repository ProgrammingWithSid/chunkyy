import { ASTNode, Chunk, ChunkType } from '../types';
import { BaseExtractor } from './base-extractor';

/**
 * Extracts interface declarations
 */
export class InterfaceExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    return this.adapter.isInterface(node);
  }

  getChunkType(): ChunkType {
    return 'interface';
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
      'interface',
      parentQualifiedName
    );

    return [chunk];
  }
}
