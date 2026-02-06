import * as ts from 'typescript';
import { ASTNode, Chunk, ChunkType } from '../types';
import { getTypeScriptNode } from '../utils/type-guards';
import { BaseExtractor } from './base-extractor';

/**
 * Extracts function declarations and expressions
 */
export class FunctionExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    // Don't handle method declarations - those are handled by MethodExtractor
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;
    if (
      ts.isMethodDeclaration(tsNode) ||
      ts.isConstructorDeclaration(tsNode) ||
      ts.isGetAccessorDeclaration(tsNode) ||
      ts.isSetAccessorDeclaration(tsNode)
    ) {
      return false;
    }

    // Don't handle variable statements - those are handled by VariableExtractor
    if (ts.isVariableStatement(tsNode)) {
      return false;
    }

    // Don't handle arrow functions in variable declarations - those are handled by VariableExtractor
    // unless we're extracting nested (parentQualifiedName is set)
    if (ts.isArrowFunction(tsNode) && tsNode.parent && ts.isVariableDeclaration(tsNode.parent)) {
      // Only handle if we're extracting nested (has parentQualifiedName in extract call)
      // Check parent node to distinguish function declarations from method declarations
      // In practice, VariableExtractor handles top-level arrow functions
      return false;
    }

    // Handle functions (including nested ones when called from extractNested)
    return this.adapter.isFunction(node);
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

    const qualifiedName = parentQualifiedName ? `${parentQualifiedName}.${name}` : name;

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

    // Extract nested functions
    const nested = this.extractNested(node, sourceCode, filePath, qualifiedName, [this]);

    // Update chunk with children
    chunk.childrenIds = nested.map((c) => c.id);

    return [chunk, ...nested];
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
