/**
 * Type guards and utilities for safely working with ASTNode types
 */
import * as ts from 'typescript';
import { ASTNode } from '../types';

/**
 * Type guard to check if ASTNode contains a TypeScript node
 */
export function hasTypeScriptNode(node: ASTNode): node is ASTNode & { _tsNode: ts.Node } {
  return '_tsNode' in node && node._tsNode !== undefined && typeof node._tsNode === 'object';
}

/**
 * Safely extract TypeScript node from ASTNode
 */
export function getTypeScriptNode(node: ASTNode): ts.Node | null {
  if (hasTypeScriptNode(node)) {
    return node._tsNode;
  }
  return null;
}

/**
 * Type guard to check if ASTNode contains a TypeScript SourceFile
 */
export function isTypeScriptSourceFile(
  node: ASTNode
): node is ASTNode & { _tsNode: ts.SourceFile } {
  const tsNode = getTypeScriptNode(node);
  return tsNode !== null && ts.isSourceFile(tsNode);
}

/**
 * Safely extract TypeScript SourceFile from ASTNode
 */
export function getTypeScriptSourceFile(node: ASTNode): ts.SourceFile | null {
  const tsNode = getTypeScriptNode(node);
  if (tsNode && ts.isSourceFile(tsNode)) {
    return tsNode;
  }
  return null;
}

/**
 * Create an ASTNode wrapper from a TypeScript node
 */
export function createASTNodeFromTS(
  tsNode: ts.Node,
  range?: { start: { line: number; column: number }; end: { line: number; column: number } }
): ASTNode {
  const sourceFile = tsNode.getSourceFile();
  const start = sourceFile.getLineAndCharacterOfPosition(tsNode.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(tsNode.getEnd());

  const astNode: ASTNode = {
    type: tsNode.kind.toString(),
    range: range || {
      start: { line: start.line + 1, column: start.character },
      end: { line: end.line + 1, column: end.character },
    },
    language: 'typescript',
  };

  // Store TypeScript node using Object.defineProperty for type safety
  Object.defineProperty(astNode, '_tsNode', { value: tsNode, writable: true, configurable: true });

  return astNode;
}
