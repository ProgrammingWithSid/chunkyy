import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import * as ParserModule from 'web-tree-sitter';
import { ASTNode, Dependency, ExportInfo, Parameter, ParserAdapter, Range } from '../types';

const Parser = ParserModule.Parser;
const Language = ParserModule.Language;
type TreeSitterNode = ParserModule.Node;
type TreeSitterLanguage = ParserModule.Language;
type TreeSitterParser = ParserModule.Parser;

/**
 * Language mapping for tree-sitter
 */
const LANGUAGE_MAP: Record<string, string> = {
  typescript: 'tree-sitter-typescript',
  javascript: 'tree-sitter-javascript',
  python: 'tree-sitter-python',
  java: 'tree-sitter-java',
  go: 'tree-sitter-go',
  rust: 'tree-sitter-rust',
  cpp: 'tree-sitter-cpp',
  c: 'tree-sitter-c',
  ruby: 'tree-sitter-ruby',
  php: 'tree-sitter-php',
};

/**
 * Tree-sitter based parser adapter for multi-language support
 * Note: Tree-sitter requires async initialization, so this adapter uses lazy initialization
 * For best results, pre-initialize parsers or use async parsing methods
 */
export class TreeSitterAdapter implements ParserAdapter {
  private sourceCode: string = '';
  private languageName: string;
  private parser: TreeSitterParser | null = null;
  private language: TreeSitterLanguage | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(languageName: string) {
    this.languageName = languageName;
  }

  /**
   * Initialize parser with language (lazy initialization)
   * This is async but parse() is sync, so we start initialization but don't wait
   */
  private ensureInitialized(): void {
    if (this.initPromise) {
      return; // Already initializing
    }

    if (this.initialized && this.parser && this.language) {
      return;
    }

    // Start async initialization (don't await - parse is sync)
    this.initPromise = this.doInitialize();
  }

  private async doInitialize(): Promise<void> {
    if (this.initialized && this.parser && this.language) {
      return;
    }

    try {
      await Parser.init();
      this.parser = new Parser();

      // Map language name to tree-sitter language package name
      const tsLanguageName = LANGUAGE_MAP[this.languageName] || `tree-sitter-${this.languageName}`;

      // Try to load language from tree-sitter-wasms
      try {
        // Use createRequire for dynamic require of optional dependency
        const requireFn = createRequire(process.cwd() + '/package.json');
        const wasms = requireFn('tree-sitter-wasms') as Record<string, string>;
        const wasmPath = wasms[tsLanguageName];

        if (wasmPath && typeof wasmPath === 'string') {
          // Load WASM file - tree-sitter-wasms provides paths to WASM files
          const wasmPathResolved = requireFn.resolve(wasmPath);
          const wasmBuffer = fs.readFileSync(wasmPathResolved);
          this.language = await Language.load(wasmBuffer);
          if (this.parser && this.language) {
            this.parser.setLanguage(this.language);
          }
          this.initialized = true;
          return;
        }
      } catch {
        // Language not available in tree-sitter-wasms
        // Only log in non-test environments to avoid Jest warnings
        if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
          console.warn(`Tree-sitter language ${tsLanguageName} not available`);
        }
      }

      // Try direct WASM file path if package lookup failed
      try {
        const requireFn = createRequire(process.cwd() + '/package.json');
        const wasmsDir = path.join(
          path.dirname(requireFn.resolve('tree-sitter-wasms/package.json')),
          'out'
        );
        const wasmFileName = `${tsLanguageName}.wasm`;
        const wasmFullPath = path.join(wasmsDir, wasmFileName);

        if (fs.existsSync(wasmFullPath)) {
          this.language = await Language.load(wasmFullPath);
          if (this.parser && this.language) {
            this.parser.setLanguage(this.language);
          }
          this.initialized = true;
          return;
        }
      } catch {
        // Ignore errors - language not available
      }

      // If we still don't have a language, mark as initialized but unusable
      this.initialized = true;
    } catch (error) {
      // Only log errors in non-test environments to avoid Jest warnings
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
        console.error(`Failed to initialize tree-sitter for ${this.languageName}:`, error);
      }
      this.initialized = true; // Mark as initialized to prevent retry loops
    }
  }

  parse(code: string, filePath: string): ASTNode {
    this.sourceCode = code;

    // Start initialization if not already started
    this.ensureInitialized();

    // If parser is not ready yet, return placeholder AST
    // In production, you'd want to wait for initialization or use async parse
    if (!this.parser || !this.language || !this.initialized) {
      const lines = code.split('\n');
      const astNode: ASTNode = {
        type: 'source_file',
        range: {
          start: { line: 1, column: 0 },
          end: { line: lines.length, column: lines[lines.length - 1]?.length || 0 },
        },
        language: this.languageName,
        _treeSitterNode: null,
      };
      Object.defineProperty(astNode, '_notReady', {
        value: true,
        writable: true,
        configurable: true,
      });
      return astNode;
    }

    try {
      const tree = this.parser.parse(code);
      if (!tree) {
        const lines = code.split('\n');
        return {
          type: 'source_file',
          range: {
            start: { line: 1, column: 0 },
            end: { line: lines.length, column: lines[lines.length - 1]?.length || 0 },
          },
          language: this.languageName,
        } as ASTNode;
      }
      const rootNode = tree.rootNode;

      const astNode: ASTNode = {
        type: rootNode.type,
        range: {
          start: { line: rootNode.startPosition.row + 1, column: rootNode.startPosition.column },
          end: { line: rootNode.endPosition.row + 1, column: rootNode.endPosition.column },
        },
        language: this.languageName,
        _treeSitterNode: rootNode,
        _treeSitterTree: tree,
      };
      return astNode;
    } catch (error) {
      // Only log errors in non-test environments to avoid Jest warnings
      if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
        console.error(`Tree-sitter parse error for ${filePath}:`, error);
      }
      const lines = code.split('\n');
      return {
        type: 'source_file',
        range: {
          start: { line: 1, column: 0 },
          end: { line: lines.length, column: lines[lines.length - 1]?.length || 0 },
        },
        language: this.languageName,
      } as ASTNode;
    }
  }

  /**
   * Parse code asynchronously (recommended for tree-sitter)
   */
  async parseAsync(code: string, filePath: string): Promise<ASTNode> {
    await this.ensureInitialized();
    return this.parse(code, filePath);
  }

  getRoot(node: ASTNode): ASTNode {
    return node;
  }

  getTopLevelDeclarations(node: ASTNode): ASTNode[] {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) {
      return [];
    }

    const declarations: ASTNode[] = [];
    const topLevelTypes = this.getTopLevelNodeTypes();

    const traverse = (n: TreeSitterNode): void => {
      if (topLevelTypes.includes(n.type)) {
        declarations.push(this.treeSitterNodeToASTNode(n));
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) {
          traverse(child);
        }
      }
    };

    traverse(tsNode);
    return declarations;
  }

  private getTopLevelNodeTypes(): string[] {
    const languageTypes: Record<string, string[]> = {
      typescript: [
        'function_declaration',
        'class_declaration',
        'interface_declaration',
        'enum_declaration',
        'type_alias_declaration',
        'variable_declaration',
      ],
      javascript: ['function_declaration', 'class_declaration', 'variable_declaration'],
      python: ['function_definition', 'class_definition'],
      java: ['class_declaration', 'interface_declaration', 'method_declaration'],
      go: ['function_declaration', 'type_declaration', 'method_declaration'],
      rust: ['function_item', 'struct_item', 'enum_item', 'impl_item'],
      cpp: ['function_definition', 'class_specifier', 'namespace_definition'],
      c: ['function_definition', 'struct_specifier'],
      ruby: ['method', 'class', 'module'],
      php: ['function_definition', 'class_declaration'],
    };

    return languageTypes[this.languageName] || languageTypes.typescript;
  }

  private treeSitterNodeToASTNode(tsNode: TreeSitterNode): ASTNode {
    const astNode: ASTNode = {
      type: tsNode.type,
      range: {
        start: { line: tsNode.startPosition.row + 1, column: tsNode.startPosition.column },
        end: { line: tsNode.endPosition.row + 1, column: tsNode.endPosition.column },
      },
      name: this.extractNodeName(tsNode),
      language: this.languageName,
      _treeSitterNode: tsNode,
    };
    return astNode;
  }

  private extractNodeName(node: TreeSitterNode): string | undefined {
    // Try to find name field in children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;

      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text;
      }

      // For some languages, name might be in a different structure
      const nameField = child.childForFieldName('name');
      if (nameField) {
        return nameField.text;
      }
    }

    return undefined;
  }

  isFunction(node: ASTNode): boolean {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return false;

    const functionTypes = [
      'function_declaration',
      'function_expression',
      'arrow_function',
      'function_definition',
      'method_declaration',
      'function_item',
      'method',
      'function_definition',
    ];
    return functionTypes.includes(tsNode.type);
  }

  isClass(node: ASTNode): boolean {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return false;

    const classTypes = [
      'class_declaration',
      'class_definition',
      'struct_item',
      'class',
      'class_specifier',
    ];
    return classTypes.includes(tsNode.type);
  }

  isInterface(node: ASTNode): boolean {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return false;

    return tsNode.type === 'interface_declaration' || tsNode.type === 'trait_item';
  }

  isEnum(node: ASTNode): boolean {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return false;

    return tsNode.type === 'enum_declaration' || tsNode.type === 'enum_item';
  }

  isTypeAlias(node: ASTNode): boolean {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return false;

    return tsNode.type === 'type_alias_declaration' || tsNode.type === 'type_declaration';
  }

  isNamespace(node: ASTNode): boolean {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return false;

    return (
      tsNode.type === 'module_declaration' ||
      tsNode.type === 'namespace_declaration' ||
      tsNode.type === 'namespace_definition' ||
      tsNode.type === 'module'
    );
  }

  getNodeName(node: ASTNode): string | undefined {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return (node as { name?: string }).name;

    return this.extractNodeName(tsNode);
  }

  getNodeRange(node: ASTNode): Range | undefined {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (tsNode) {
      return {
        start: { line: tsNode.startPosition.row + 1, column: tsNode.startPosition.column },
        end: { line: tsNode.endPosition.row + 1, column: tsNode.endPosition.column },
      };
    }

    return node.range;
  }

  getChildren(node: ASTNode): ASTNode[] {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return [];

    const children: ASTNode[] = [];
    for (let i = 0; i < tsNode.childCount; i++) {
      const child = tsNode.child(i);
      if (child) {
        children.push(this.treeSitterNodeToASTNode(child));
      }
    }
    return children;
  }

  isExported(node: ASTNode): boolean {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return false;

    // Check if node has export modifier
    const parent = tsNode.parent;
    if (parent && (parent.type === 'export_statement' || parent.type === 'export_declaration')) {
      return true;
    }

    // Check for export keyword in node text
    const nodeText = tsNode.text;
    return nodeText.includes('export ') || nodeText.startsWith('export ');
  }

  getExportName(node: ASTNode): string | undefined {
    if (!this.isExported(node)) return undefined;
    return this.getNodeName(node);
  }

  getImports(node: ASTNode): Dependency[] {
    const imports: Dependency[] = [];
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return imports;

    const traverse = (n: TreeSitterNode): void => {
      if (n.type === 'import_statement' || n.type === 'import_declaration') {
        // Extract import information
        const sourceNode = n.childForFieldName('source') || n.descendantsOfType('string')[0];
        if (sourceNode) {
          const source = sourceNode.text.replace(/['"]/g, '');
          const nameNodes = n.descendantsOfType('identifier');

          if (nameNodes.length > 0) {
            for (const nameNode of nameNodes) {
              if (nameNode) {
                imports.push({
                  name: nameNode.text,
                  source,
                  type: 'import',
                });
              }
            }
          } else {
            imports.push({
              name: '*',
              source,
              type: 'import',
              namespace: true,
            });
          }
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) traverse(child);
      }
    };

    traverse(tsNode);
    return imports;
  }

  getExports(node: ASTNode): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return exports;

    const traverse = (n: TreeSitterNode): void => {
      if (n.type === 'export_statement' || n.type === 'export_declaration') {
        const exportedNode = n.childForFieldName('declaration') || n.namedChildren[0];
        if (exportedNode) {
          const name = this.extractNodeName(exportedNode);
          if (name) {
            exports.push({
              name,
              type: 'export',
              chunkId: '',
            });
          }
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) traverse(child);
      }
    };

    traverse(tsNode);
    return exports;
  }

  getDecorators(node: ASTNode): string[] {
    // Tree-sitter doesn't have decorators in all languages
    // Check if node has decorator children (some languages like TypeScript support decorators)
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) {
      return [];
    }

    const decorators: string[] = [];
    // Look for decorator nodes in children
    for (let i = 0; i < tsNode.childCount; i++) {
      const child = tsNode.child(i);
      if (child && child.type === 'decorator') {
        decorators.push(child.text);
      }
    }
    return decorators;
  }

  getTypeParameters(node: ASTNode): string[] {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return [];

    const typeParams: string[] = [];
    const typeParamNode =
      tsNode.childForFieldName('type_parameters') || tsNode.descendantsOfType('type_parameter')[0];

    if (typeParamNode) {
      const identifiers = typeParamNode.descendantsOfType('type_identifier');
      for (const ident of identifiers) {
        if (ident) {
          typeParams.push(ident.text);
        }
      }
    }

    return typeParams;
  }

  getParameters(node: ASTNode): Parameter[] {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return [];

    const parameters: Parameter[] = [];
    const paramList =
      tsNode.childForFieldName('parameters') || tsNode.descendantsOfType('formal_parameters')[0];

    if (paramList) {
      const paramNodes = paramList.namedChildren.filter(
        (n: TreeSitterNode | null): n is TreeSitterNode =>
          n !== null &&
          (n.type === 'parameter' ||
            n.type === 'required_parameter' ||
            n.type === 'optional_parameter')
      );

      for (const param of paramNodes) {
        const nameNode =
          param.childForFieldName('name') || param.descendantsOfType('identifier')[0];
        const typeNode =
          param.childForFieldName('type') || param.descendantsOfType('type_identifier')[0];

        if (nameNode) {
          parameters.push({
            name: nameNode.text,
            type: typeNode?.text,
            optional: param.type === 'optional_parameter' || param.text.includes('?'),
          });
        }
      }
    }

    return parameters;
  }

  getReturnType(node: ASTNode): string | undefined {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return undefined;

    const returnTypeNode =
      tsNode.childForFieldName('return_type') || tsNode.descendantsOfType('type_annotation')[0];
    return returnTypeNode?.text;
  }

  getJSDoc(node: ASTNode): string | undefined {
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;
    if (!tsNode) return undefined;

    // Look for comment nodes before this node
    const prevSibling = tsNode.previousSibling;
    if (prevSibling && prevSibling.type === 'comment') {
      const commentText = prevSibling.text;
      if (commentText.includes('/**')) {
        return commentText;
      }
    }

    return undefined;
  }

  extractCode(node: ASTNode, sourceCode?: string): string {
    const code = sourceCode || this.sourceCode;
    const tsNode = (node as { _treeSitterNode?: TreeSitterNode })._treeSitterNode;

    if (tsNode) {
      return tsNode.text;
    }

    // Fallback to range-based extraction
    const range = node.range;
    if (!range) return code;

    const lines = code.split('\n');
    const startLine = Math.max(0, range.start.line - 1);
    const endLine = Math.min(lines.length - 1, range.end.line - 1);

    if (startLine === endLine) {
      return lines[startLine]?.substring(range.start.column, range.end.column) || '';
    }

    const result: string[] = [];
    result.push(lines[startLine]?.substring(range.start.column) || '');
    for (let i = startLine + 1; i < endLine; i++) {
      result.push(lines[i] || '');
    }
    result.push(lines[endLine]?.substring(0, range.end.column) || '');

    return result.join('\n');
  }
}
