import * as ts from 'typescript';
import { ASTNode, Chunk, ChunkType } from '../types';
import { BaseExtractor } from './base-extractor';
import { getTypeScriptNode } from '../utils/type-guards';

/**
 * Extracts type alias declarations
 */
export class TypeAliasExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;
    return ts.isTypeAliasDeclaration(tsNode);
  }

  getChunkType(): ChunkType {
    return 'type-alias';
  }

  extract(
    node: ASTNode,
    sourceCode: string,
    filePath: string,
    parentQualifiedName?: string
  ): Chunk[] {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !ts.isTypeAliasDeclaration(tsNode)) {
      return [];
    }

    const name = tsNode.name.text;
    if (!name) {
      return [];
    }

    const qualifiedName = parentQualifiedName ? `${parentQualifiedName}.${name}` : name;

    // Check if exported
    const exported = this.isExported(tsNode);

    const chunk = this.createChunk(
      node,
      sourceCode,
      filePath,
      name,
      qualifiedName,
      'type-alias',
      parentQualifiedName
    );

    chunk.exported = exported;

    // Extract type parameters (generics)
    if (tsNode.typeParameters) {
      chunk.typeParameters = tsNode.typeParameters.map((tp) => tp.name.text);
    }

    return [chunk];
  }

  private isExported(node: ts.TypeAliasDeclaration): boolean {
    return (
      (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0 ||
      (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)
    );
  }
}
