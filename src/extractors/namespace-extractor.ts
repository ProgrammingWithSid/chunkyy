import * as ts from 'typescript';
import { ASTNode, Chunk, ChunkType } from '../types';
import { BaseExtractor } from './base-extractor';
import { getTypeScriptNode } from '../utils/type-guards';

/**
 * Extracts namespace declarations
 */
export class NamespaceExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    return this.adapter.isNamespace(node);
  }

  getChunkType(): ChunkType {
    return 'namespace';
  }

  extract(
    node: ASTNode,
    sourceCode: string,
    filePath: string,
    parentQualifiedName?: string
  ): Chunk[] {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !ts.isModuleDeclaration(tsNode)) {
      return [];
    }

    const name = tsNode.name;
    if (!name || !ts.isIdentifier(name)) {
      return [];
    }

    const nameText = name.text;
    const qualifiedName = parentQualifiedName ? `${parentQualifiedName}.${nameText}` : nameText;

    // Check if exported
    const exported = this.isExported(tsNode);

    const chunk = this.createChunk(
      node,
      sourceCode,
      filePath,
      nameText,
      qualifiedName,
      'namespace',
      parentQualifiedName
    );

    chunk.exported = exported;

    // Extract nested declarations if namespace has a body
    if (tsNode.body && ts.isModuleBlock(tsNode.body)) {
      // Namespace can contain functions, classes, etc.
      // For now, just return the namespace chunk
      // Nested extraction can be added later if needed
      chunk.childrenIds = [];
    }

    return [chunk];
  }

  private isExported(node: ts.ModuleDeclaration): boolean {
    const modifiers = ts.getModifiers(node);
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }
}
