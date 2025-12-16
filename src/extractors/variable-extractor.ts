import * as ts from 'typescript';
import { ASTNode, Chunk, ChunkType } from '../types';
import { createASTNodeFromTS, getTypeScriptNode } from '../utils/type-guards';
import { BaseExtractor } from './base-extractor';

/**
 * Extracts variable declarations (const/let) that contain functions or are exported
 */
export class VariableExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;

    // Handle variable statements (const, let, var)
    if (ts.isVariableStatement(tsNode)) {
      // Check if any declaration has an arrow function or is exported
      for (const declaration of tsNode.declarationList.declarations) {
        if (declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
          return true;
        }
      }
      // Check if exported
      const modifiers = ts.getModifiers(tsNode);
      if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        return true;
      }
    }

    return false;
  }

  getChunkType(): ChunkType {
    return 'function'; // Arrow functions are treated as functions
  }

  extract(
    node: ASTNode,
    sourceCode: string,
    filePath: string,
    parentQualifiedName?: string
  ): Chunk[] {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !ts.isVariableStatement(tsNode)) {
      return [];
    }

    const chunks: Chunk[] = [];

    const sourceFile = tsNode.getSourceFile();
    for (const declaration of tsNode.declarationList.declarations) {
      const name = declaration.name.getText(sourceFile);
      if (!name) continue;

      // Only extract if it's an arrow function or exported
      const isArrowFunction = declaration.initializer && ts.isArrowFunction(declaration.initializer);
      const isExported = this.isExported(tsNode);

      if (isArrowFunction || isExported) {
        const qualifiedName = parentQualifiedName ? `${parentQualifiedName}.${name}` : name;

        // For arrow functions, create a function chunk
        if (isArrowFunction) {
          // Create AST node for the arrow function itself
          const arrowFunc = declaration.initializer as ts.ArrowFunction;
          const arrowFuncNode = createASTNodeFromTS(arrowFunc);
          const chunk = this.createChunk(
            arrowFuncNode,
            sourceCode,
            filePath,
            name,
            qualifiedName,
            'function',
            parentQualifiedName
          );

          // Mark as exported if variable statement is exported
          chunk.exported = isExported;
          if (isExported) {
            chunk.exportName = this.adapter.getExportName(node) || name;
          }

          // Mark as async if needed
          chunk.async = (arrowFunc.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) ?? false;

          // Extract parameters and return type from arrow function
          if (arrowFunc.parameters) {
            chunk.parameters = arrowFunc.parameters.map((param) => ({
              name: param.name.getText(sourceFile),
              type: param.type ? param.type.getText(sourceFile) : undefined,
            }));
          }
          if (arrowFunc.type) {
            chunk.returnType = arrowFunc.type.getText(sourceFile);
          }

          chunks.push(chunk);
        } else if (isExported) {
          // For exported constants, create an export chunk
          const chunk = this.createChunk(
            node,
            sourceCode,
            filePath,
            name,
            qualifiedName,
            'export',
            parentQualifiedName
          );
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  }

  private isExported(node: ts.VariableStatement): boolean {
    const modifiers = ts.getModifiers(node);
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }
}
