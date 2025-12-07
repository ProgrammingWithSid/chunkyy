import { ASTNode, Chunk, ChunkType } from '../types';
import { BaseExtractor } from './base-extractor';

/**
 * Extracts function declarations and expressions
 */
export class FunctionExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    return (
      this.adapter.isFunction(node) &&
      // Only handle top-level functions or arrow functions assigned to variables
      (this.isTopLevelFunction(node) || this.isArrowFunctionAssignment(node))
    );
  }

  getChunkType(): ChunkType {
    return 'function';
  }

  extract(
    node: ASTNode,
    sourceCode: string,
    filePath: string,
    parentQualifiedName?: string
  ): Chunk[] {
    const name = this.adapter.getNodeName(node);
    if (!name) {
      // Anonymous functions - skip or handle specially
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
      'function',
      parentQualifiedName
    );

    // Check if async or generator
    const nodeText = this.adapter.extractCode(node, sourceCode);
    chunk.async = nodeText.includes('async');
    chunk.generator = nodeText.includes('function*') || nodeText.includes('*');

    return [chunk];
  }

  private isTopLevelFunction(_node: ASTNode): boolean {
    // Check if parent is source file or module
    // Simplified - in practice, check parent node type
    void _node; // Parameter required but not used in simplified implementation
    return true;
  }

  private isArrowFunctionAssignment(_node: ASTNode): boolean {
    // Check if this is an arrow function assigned to a variable
    // This would be handled by variable declaration extractor in practice
    void _node;
    return false;
  }
}
