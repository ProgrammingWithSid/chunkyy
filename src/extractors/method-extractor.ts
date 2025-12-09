import * as ts from 'typescript';
import { ASTNode, Chunk, ChunkType } from '../types';
import { getTypeScriptNode } from '../utils/type-guards';
import { BaseExtractor } from './base-extractor';

/**
 * Extracts methods from classes
 */
export class MethodExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    // Methods are functions that are children of classes
    // Check specifically for method declarations
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;

    // Must be a method declaration specifically
    if (!ts.isMethodDeclaration(tsNode)) {
      return false;
    }

    // Verify it has a valid range
    const range = this.adapter.getNodeRange(node);
    return range !== undefined;
  }

  getChunkType(): ChunkType {
    return 'method';
  }

  extract(
    node: ASTNode,
    sourceCode: string,
    filePath: string,
    parentQualifiedName?: string
  ): Chunk[] {
    if (!parentQualifiedName) {
      // Methods must have a parent class
      return [];
    }

    const name = this.adapter.getNodeName(node);
    if (!name) {
      return [];
    }

    const qualifiedName = `${parentQualifiedName}.${name}`;

    const chunk = this.createChunk(
      node,
      sourceCode,
      filePath,
      name,
      qualifiedName,
      'method',
      parentQualifiedName
    );

    // Determine visibility
    const nodeText = this.adapter.extractCode(node, sourceCode);
    if (nodeText.includes('private')) {
      chunk.visibility = 'private';
    } else if (nodeText.includes('protected')) {
      chunk.visibility = 'protected';
    } else {
      chunk.visibility = 'public';
    }

    // Check if async or generator
    chunk.async = nodeText.includes('async');
    chunk.generator = nodeText.includes('*');

    return [chunk];
  }
}
