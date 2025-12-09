import { ASTNode, Chunk, ChunkType } from '../types';
import { BaseExtractor } from './base-extractor';

/**
 * Extracts enum declarations
 */
export class EnumExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    return this.adapter.isEnum(node);
  }

  getChunkType(): ChunkType {
    return 'enum';
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

    const qualifiedName = parentQualifiedName ? `${parentQualifiedName}.${name}` : name;

    const chunk = this.createChunk(
      node,
      sourceCode,
      filePath,
      name,
      qualifiedName,
      'enum',
      parentQualifiedName
    );

    return [chunk];
  }
}
