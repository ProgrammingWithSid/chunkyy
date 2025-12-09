import * as ts from 'typescript';
import { ASTNode, ParserAdapter, Range } from '../types';
import { createASTNodeFromTS, getTypeScriptSourceFile } from '../utils/type-guards';
import { TypeScriptAdapter } from './typescript-adapter';

/**
 * Vue Single File Component adapter
 * Extracts script sections from Vue SFCs and parses them as TypeScript/JavaScript
 * Supports both Composition API (<script setup>) and Options API
 */
export class VueAdapter implements ParserAdapter {
  private tsAdapter: TypeScriptAdapter;
  private sourceCode: string = '';
  private scriptContent: string = '';
  private scriptStartLine: number = 0;
  private scriptEndLine: number = 0;
  private originalFilePath: string = '';
  private isOptionsAPI: boolean = false;
  private optionsAPIObject: ts.ObjectLiteralExpression | null = null;

  constructor() {
    this.tsAdapter = new TypeScriptAdapter();
  }

  /**
   * Extract script section from Vue SFC
   * Prefers <script setup> over regular <script>
   */
  private extractScriptSection(
    vueCode: string
  ): { content: string; startLine: number; endLine: number } | null {
    // Match <script> or <script setup> tags
    // Support both single-line and multi-line script tags
    const scriptRegex =
      /<script(?:\s+setup)?(?:\s+lang=["']ts["'])?(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;

    let match;
    const matches: RegExpExecArray[] = [];

    // Find all script tags
    while ((match = scriptRegex.exec(vueCode)) !== null) {
      matches.push(match);
    }

    if (matches.length === 0) {
      return null;
    }

    // Prefer <script setup> over regular <script>
    let selectedMatch: RegExpExecArray | null = null;
    for (const m of matches) {
      if (m[0].includes('setup')) {
        selectedMatch = m;
        break;
      }
    }

    // If no setup script found, use the last script tag
    if (!selectedMatch) {
      selectedMatch = matches[matches.length - 1];
    }

    if (!selectedMatch || !selectedMatch[1]) {
      return null;
    }

    const scriptContent = selectedMatch[1].trim();
    if (!scriptContent) {
      return null;
    }

    // Calculate line numbers
    const beforeScript = vueCode.substring(0, selectedMatch.index);
    const startLine = (beforeScript.match(/\n/g) || []).length + 1;

    const scriptSection = selectedMatch[0];
    const endLine = startLine + (scriptSection.match(/\n/g) || []).length;

    return {
      content: scriptContent,
      startLine,
      endLine,
    };
  }

  parse(code: string, filePath: string): ASTNode {
    this.sourceCode = code;
    this.originalFilePath = filePath;
    this.isOptionsAPI = false;
    this.optionsAPIObject = null;

    const scriptSection = this.extractScriptSection(code);

    if (!scriptSection || !scriptSection.content.trim()) {
      // No script section found or empty script, return empty AST
      // Create a minimal valid SourceFile structure
      const tempFilePath = filePath.replace(/\.vue$/, '.ts');
      return this.tsAdapter.parse('', tempFilePath);
    }

    this.scriptContent = scriptSection.content;
    this.scriptStartLine = scriptSection.startLine;
    this.scriptEndLine = scriptSection.endLine;

    // Parse script content as TypeScript
    // Use .ts extension to ensure TypeScript parsing
    const tempFilePath = filePath.replace(/\.vue$/, '.ts');
    return this.tsAdapter.parse(this.scriptContent, tempFilePath);
  }

  getRoot(node: ASTNode): ASTNode {
    return this.tsAdapter.getRoot(node);
  }

  /**
   * Get top-level declarations, including Vue Options API properties
   */
  getTopLevelDeclarations(node: ASTNode): ASTNode[] {
    const declarations = this.tsAdapter.getTopLevelDeclarations(node);
    const sourceFile = getTypeScriptSourceFile(node);
    if (!sourceFile) return declarations;

    // Check for Vue Options API: export default { ... }
    for (const statement of sourceFile.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        const expression = statement.expression;
        if (ts.isObjectLiteralExpression(expression)) {
          this.isOptionsAPI = true;
          this.optionsAPIObject = expression;

          // Return the Options API object properties as top-level declarations
          // This allows extractors to process methods, computed, etc.
          return expression.properties.map((prop) => createASTNodeFromTS(prop));
        }
      }
    }

    // For Composition API or regular code, return normal declarations
    return declarations;
  }

  isFunction(node: ASTNode): boolean {
    const tsNode = node._tsNode as ts.Node | undefined;
    if (!tsNode) return this.tsAdapter.isFunction(node);

    // Handle Vue Options API: methods, computed properties, lifecycle hooks
    if (this.isOptionsAPI) {
      // Property assignments in Options API can be functions
      if (ts.isPropertyAssignment(tsNode)) {
        const initializer = tsNode.initializer;
        return (
          ts.isFunctionExpression(initializer) ||
          ts.isArrowFunction(initializer) ||
          ts.isObjectLiteralExpression(initializer)
        ); // methods/computed objects
      }

      // Method declarations in methods/computed objects
      if (ts.isMethodDeclaration(tsNode)) {
        return true;
      }
    }

    return this.tsAdapter.isFunction(node);
  }

  isClass(node: ASTNode): boolean {
    return this.tsAdapter.isClass(node);
  }

  isInterface(node: ASTNode): boolean {
    return this.tsAdapter.isInterface(node);
  }

  isEnum(node: ASTNode): boolean {
    return this.tsAdapter.isEnum(node);
  }

  isTypeAlias(node: ASTNode): boolean {
    return this.tsAdapter.isTypeAlias(node);
  }

  isNamespace(node: ASTNode): boolean {
    return this.tsAdapter.isNamespace(node);
  }

  getNodeName(node: ASTNode): string | undefined {
    const tsNode = node._tsNode as ts.Node | undefined;
    if (!tsNode) return this.tsAdapter.getNodeName(node);

    // Handle Vue Options API property names
    if (ts.isPropertyAssignment(tsNode)) {
      const name = tsNode.name;
      if (ts.isIdentifier(name)) {
        return name.text;
      }
    }

    // Handle method declarations in Options API
    if (ts.isMethodDeclaration(tsNode)) {
      const name = tsNode.name;
      if (ts.isIdentifier(name)) {
        return name.text;
      }
    }

    return this.tsAdapter.getNodeName(node);
  }

  /**
   * Adjust range to account for Vue SFC structure
   * Script section starts at scriptStartLine, so we need to offset
   */
  getNodeRange(node: ASTNode): Range | undefined {
    const range = this.tsAdapter.getNodeRange(node);
    if (!range) return undefined;

    // Adjust line numbers to account for script tag position in Vue file
    // The script content starts after the opening <script> tag
    const scriptTagOffset = 1; // Account for the <script> tag line

    return {
      start: {
        line: range.start.line + this.scriptStartLine + scriptTagOffset - 1,
        column: range.start.column,
      },
      end: {
        line: range.end.line + this.scriptStartLine + scriptTagOffset - 1,
        column: range.end.column,
      },
    };
  }

  getChildren(node: ASTNode): ASTNode[] {
    const tsNode = node._tsNode as ts.Node | undefined;
    if (!tsNode) return this.tsAdapter.getChildren(node);

    // Handle Vue Options API: extract nested properties from methods/computed objects
    if (this.isOptionsAPI && ts.isPropertyAssignment(tsNode)) {
      const initializer = tsNode.initializer;
      if (ts.isObjectLiteralExpression(initializer)) {
        // Return properties of methods/computed objects as children
        return initializer.properties.map((prop) => createASTNodeFromTS(prop));
      }
    }

    return this.tsAdapter.getChildren(node);
  }

  isExported(node: ASTNode): boolean {
    // In Vue SFCs with <script setup>, everything is implicitly exported
    // For now, use TypeScript adapter logic
    return this.tsAdapter.isExported(node);
  }

  getExportName(node: ASTNode): string | undefined {
    return this.tsAdapter.getExportName(node);
  }

  getImports(node: ASTNode): ReturnType<ParserAdapter['getImports']> {
    return this.tsAdapter.getImports(node);
  }

  getExports(node: ASTNode): ReturnType<ParserAdapter['getExports']> {
    return this.tsAdapter.getExports(node);
  }

  getDecorators(node: ASTNode): string[] {
    return this.tsAdapter.getDecorators(node);
  }

  getTypeParameters(node: ASTNode): string[] {
    return this.tsAdapter.getTypeParameters(node);
  }

  getParameters(node: ASTNode): ReturnType<ParserAdapter['getParameters']> {
    return this.tsAdapter.getParameters(node);
  }

  getReturnType(node: ASTNode): string | undefined {
    return this.tsAdapter.getReturnType(node);
  }

  getJSDoc(node: ASTNode): string | undefined {
    return this.tsAdapter.getJSDoc(node);
  }

  /**
   * Extract code from Vue SFC, adjusting for script section position
   */
  extractCode(node: ASTNode, sourceCode?: string): string {
    // Use the script content for extraction
    const code = sourceCode || this.scriptContent;
    return this.tsAdapter.extractCode(node, code);
  }
}
