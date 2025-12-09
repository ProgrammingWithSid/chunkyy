import * as ts from 'typescript';
import {
  ASTNode,
  ChunkType,
  Dependency,
  ExportInfo,
  Parameter,
  ParserAdapter,
  Range,
} from '../types';
import {
  createASTNodeFromTS,
  getTypeScriptNode,
  getTypeScriptSourceFile,
} from '../utils/type-guards';

/**
 * TypeScript Compiler API adapter
 */
export class TypeScriptAdapter implements ParserAdapter {
  private sourceFile: ts.SourceFile | null = null;
  private sourceCode: string = '';

  parse(code: string, filePath: string): ASTNode {
    this.sourceCode = code;
    this.sourceFile = ts.createSourceFile(
      filePath,
      code,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    return createASTNodeFromTS(this.sourceFile);
  }

  getRoot(node: ASTNode): ASTNode {
    return node;
  }

  getTopLevelDeclarations(node: ASTNode): ASTNode[] {
    const sourceFile = getTypeScriptSourceFile(node);
    if (!sourceFile) {
      return [];
    }
    return sourceFile.statements.map((stmt) => createASTNodeFromTS(stmt));
  }

  isFunction(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;
    return (
      ts.isFunctionDeclaration(tsNode) ||
      ts.isFunctionExpression(tsNode) ||
      ts.isArrowFunction(tsNode) ||
      ts.isMethodDeclaration(tsNode)
    );
  }

  isClass(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    return tsNode !== null && ts.isClassDeclaration(tsNode);
  }

  isInterface(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    return tsNode !== null && ts.isInterfaceDeclaration(tsNode);
  }

  isEnum(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    return tsNode !== null && ts.isEnumDeclaration(tsNode);
  }

  isTypeAlias(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    return tsNode !== null && ts.isTypeAliasDeclaration(tsNode);
  }

  isNamespace(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;
    const moduleNode = tsNode as ts.ModuleDeclaration;
    return ts.isModuleDeclaration(tsNode) && moduleNode.name !== undefined;
  }

  getNodeName(node: ASTNode): string | undefined {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return node.name;

    if (
      ts.isFunctionDeclaration(tsNode) ||
      ts.isClassDeclaration(tsNode) ||
      ts.isInterfaceDeclaration(tsNode) ||
      ts.isEnumDeclaration(tsNode) ||
      ts.isTypeAliasDeclaration(tsNode)
    ) {
      return tsNode.name?.getText(this.sourceFile!) || undefined;
    }

    if (ts.isMethodDeclaration(tsNode) || ts.isPropertyDeclaration(tsNode)) {
      return tsNode.name?.getText(this.sourceFile!) || undefined;
    }

    if (ts.isVariableDeclaration(tsNode)) {
      return tsNode.name.getText(this.sourceFile!);
    }

    return undefined;
  }

  getNodeRange(node: ASTNode): Range | undefined {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !this.sourceFile) return node.range;

    try {
      // Get start and end positions
      const startPos = tsNode.getStart(this.sourceFile);
      const endPos = tsNode.getEnd();

      const start = this.sourceFile.getLineAndCharacterOfPosition(startPos);
      const end = this.sourceFile.getLineAndCharacterOfPosition(endPos);

      return {
        start: {
          line: start.line + 1, // Convert to 1-indexed
          column: start.character,
        },
        end: {
          line: end.line + 1,
          column: end.character,
        },
      };
    } catch (error) {
      // If we can't get range, return undefined
      return undefined;
    }
  }

  getChildren(node: ASTNode): ASTNode[] {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return [];

    const children: ASTNode[] = [];

    // For class declarations, get members from the class body
    if (ts.isClassDeclaration(tsNode) && tsNode.members) {
      for (const member of tsNode.members) {
        children.push(createASTNodeFromTS(member));
      }
      return children;
    }

    // For interface declarations, get members
    if (ts.isInterfaceDeclaration(tsNode) && tsNode.members) {
      for (const member of tsNode.members) {
        children.push(createASTNodeFromTS(member));
      }
      return children;
    }

    // For other nodes, get all children
    ts.forEachChild(tsNode, (child: ts.Node) => {
      children.push(createASTNodeFromTS(child));
    });

    return children;
  }

  isExported(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;

    // Check for export modifier
    if (ts.canHaveModifiers(tsNode)) {
      const modifiers = ts.getModifiers(tsNode);
      return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    }

    // Check if parent is export declaration
    if (tsNode.parent) {
      if (ts.isExportDeclaration(tsNode.parent) || ts.isExportAssignment(tsNode.parent)) {
        return true;
      }
    }

    return false;
  }

  getExportName(node: ASTNode): string | undefined {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !tsNode.parent) return undefined;

    if (ts.isExportDeclaration(tsNode.parent)) {
      const exportDecl = tsNode.parent;
      if (exportDecl.exportClause && ts.isNamedExports(exportDecl.exportClause)) {
        // Find the specific export
        for (const element of exportDecl.exportClause.elements) {
          if (element.propertyName) {
            return element.propertyName.getText(this.sourceFile!);
          }
          return element.name.getText(this.sourceFile!);
        }
      }
    }

    return this.getNodeName(node);
  }

  getImports(node: ASTNode): Dependency[] {
    const imports: Dependency[] = [];
    const sourceFile = getTypeScriptSourceFile(node);
    if (!sourceFile) return imports;

    const visit = (n: ts.Node) => {
      // Import declarations
      if (ts.isImportDeclaration(n)) {
        const importDecl = n;
        const moduleSpecifier = importDecl.moduleSpecifier;

        if (ts.isStringLiteral(moduleSpecifier)) {
          const source = moduleSpecifier.text;

          if (importDecl.importClause) {
            // Default import
            if (importDecl.importClause.name) {
              imports.push({
                name: importDecl.importClause.name.getText(sourceFile),
                source,
                type: 'import',
                default: true,
              });
            }

            // Named imports
            if (importDecl.importClause.namedBindings) {
              if (ts.isNamespaceImport(importDecl.importClause.namedBindings)) {
                imports.push({
                  name: importDecl.importClause.namedBindings.name.getText(sourceFile),
                  source,
                  type: 'import',
                  namespace: true,
                });
              } else if (ts.isNamedImports(importDecl.importClause.namedBindings)) {
                for (const element of importDecl.importClause.namedBindings.elements) {
                  imports.push({
                    name: element.name.getText(sourceFile),
                    source,
                    type: 'import',
                    default: false,
                  });
                }
              }
            }
          }
        }
      }

      // Dynamic imports
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = n.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          imports.push({
            name: '*',
            source: arg.text,
            type: 'dynamic-import',
          });
        }
      }

      ts.forEachChild(n, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return imports;
  }

  getExports(node: ASTNode): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const sourceFile = getTypeScriptSourceFile(node);
    if (!sourceFile) return exports;

    const visit = (n: ts.Node) => {
      // Export declarations
      if (ts.isExportDeclaration(n)) {
        const exportDecl = n;
        if (exportDecl.exportClause) {
          if (ts.isNamedExports(exportDecl.exportClause)) {
            for (const element of exportDecl.exportClause.elements) {
              exports.push({
                name: element.name.getText(sourceFile),
                type: 'export' as ChunkType,
                chunkId: '', // Will be filled later
              });
            }
          }
        }
      }

      // Export assignments
      if (ts.isExportAssignment(n)) {
        exports.push({
          name: 'default',
          type: 'export' as ChunkType,
          chunkId: '',
          default: true,
        });
      }

      // Direct exports (export function, export class, etc.)
      const astNode = createASTNodeFromTS(n);
      if (this.isExported(astNode)) {
        const name = this.getNodeName(astNode);
        if (name) {
          let type: ChunkType = 'export';
          if (this.isFunction(astNode)) type = 'function';
          else if (this.isClass(astNode)) type = 'class';
          else if (this.isInterface(astNode)) type = 'interface';
          else if (this.isEnum(astNode)) type = 'enum';

          exports.push({
            name,
            type,
            chunkId: '',
          });
        }
      }

      ts.forEachChild(n, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return exports;
  }

  getDecorators(node: ASTNode): string[] {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !this.sourceFile || !ts.canHaveDecorators(tsNode)) return [];

    const decorators = ts.getDecorators(tsNode);
    if (!decorators) return [];

    return decorators.map((d) => {
      if (ts.isCallExpression(d.expression)) {
        return d.expression.expression.getText(this.sourceFile!);
      }
      return d.expression.getText(this.sourceFile!);
    });
  }

  getTypeParameters(node: ASTNode): string[] {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !this.sourceFile) return [];

    let typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined;

    if (ts.isFunctionDeclaration(tsNode) || ts.isMethodDeclaration(tsNode)) {
      typeParams = (tsNode as ts.FunctionDeclaration | ts.MethodDeclaration).typeParameters;
    } else if (ts.isClassDeclaration(tsNode) || ts.isInterfaceDeclaration(tsNode)) {
      typeParams = (tsNode as ts.ClassDeclaration | ts.InterfaceDeclaration).typeParameters;
    } else if (ts.isTypeAliasDeclaration(tsNode)) {
      typeParams = (tsNode as ts.TypeAliasDeclaration).typeParameters;
    }

    if (!typeParams) return [];

    return typeParams.map((tp) => tp.name.getText(this.sourceFile!));
  }

  getParameters(node: ASTNode): Parameter[] {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !this.sourceFile) return [];

    let params: ts.NodeArray<ts.ParameterDeclaration> | undefined;

    if (ts.isFunctionDeclaration(tsNode) || ts.isMethodDeclaration(tsNode)) {
      params = (tsNode as ts.FunctionDeclaration | ts.MethodDeclaration).parameters;
    } else if (ts.isFunctionExpression(tsNode) || ts.isArrowFunction(tsNode)) {
      params = (tsNode as ts.FunctionExpression | ts.ArrowFunction).parameters;
    }

    if (!params) return [];

    return params.map((param) => {
      const name = param.name.getText(this.sourceFile!);
      const type = param.type?.getText(this.sourceFile!);
      const optional = param.questionToken !== undefined;
      const defaultValue = param.initializer?.getText(this.sourceFile!);

      return {
        name,
        type,
        optional,
        defaultValue,
      };
    });
  }

  getReturnType(node: ASTNode): string | undefined {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !this.sourceFile) return undefined;

    if (ts.isFunctionDeclaration(tsNode) || ts.isMethodDeclaration(tsNode)) {
      return (tsNode as ts.FunctionDeclaration | ts.MethodDeclaration).type?.getText(
        this.sourceFile!
      );
    }

    if (ts.isFunctionExpression(tsNode) || ts.isArrowFunction(tsNode)) {
      return (tsNode as ts.FunctionExpression | ts.ArrowFunction).type?.getText(this.sourceFile!);
    }

    return undefined;
  }

  getJSDoc(node: ASTNode): string | undefined {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode || !this.sourceFile) return undefined;

    const jsDocTags = ts.getJSDocTags(tsNode);

    if (jsDocTags.length > 0) {
      return jsDocTags.map((tag) => tag.getText(this.sourceFile!)).join('\n');
    }

    // Also check for JSDoc comments
    const comments = ts.getLeadingCommentRanges(this.sourceCode, tsNode.getFullStart());
    if (comments) {
      for (const comment of comments) {
        if (comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
          const text = this.sourceCode.substring(comment.pos, comment.end);
          if (text.startsWith('/**')) {
            return text;
          }
        }
      }
    }

    return undefined;
  }

  extractCode(node: ASTNode, sourceCode: string): string {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) {
      // Fallback to range-based extraction if no TypeScript node
      if (node.range) {
        const lines = sourceCode.split('\n');
        const startLine = Math.max(0, node.range.start.line - 1);
        const endLine = Math.min(lines.length - 1, node.range.end.line - 1);
        if (startLine === endLine) {
          return lines[startLine]?.substring(node.range.start.column, node.range.end.column) || '';
        }
        const result: string[] = [];
        result.push(lines[startLine]?.substring(node.range.start.column) || '');
        for (let i = startLine + 1; i < endLine; i++) {
          result.push(lines[i] || '');
        }
        result.push(lines[endLine]?.substring(0, node.range.end.column) || '');
        return result.join('\n');
      }
      return '';
    }
    return sourceCode.substring(tsNode.getStart(), tsNode.getEnd());
  }
}
