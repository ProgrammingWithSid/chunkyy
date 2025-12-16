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
    // Check specifically for method declarations, constructors, getters, and setters
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;

    // Handle method declarations, constructors, getters, and setters
    if (
      ts.isMethodDeclaration(tsNode) ||
      ts.isConstructorDeclaration(tsNode) ||
      ts.isGetAccessorDeclaration(tsNode) ||
      ts.isSetAccessorDeclaration(tsNode)
    ) {
      // Verify it has a valid range
      const range = this.adapter.getNodeRange(node);
      return range !== undefined;
    }

    return false;
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

    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return [];

    // Get name - handle constructors specially
    let name: string | undefined;
    if (ts.isConstructorDeclaration(tsNode)) {
      name = 'constructor';
    } else if (ts.isGetAccessorDeclaration(tsNode) || ts.isSetAccessorDeclaration(tsNode)) {
      name = this.adapter.getNodeName(node);
    } else {
      name = this.adapter.getNodeName(node);
    }

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
