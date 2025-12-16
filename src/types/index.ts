/**
 * Core type definitions for Chunkyyy
 */

export type ParserType = 'typescript' | 'swc' | 'babel' | 'esprima' | 'treesitter';
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'c'
  | 'ruby'
  | 'php'
  | 'vue';

export type ChunkType =
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'enum'
  | 'type-alias'
  | 'namespace'
  | 'export'
  | 'top-level-declaration'
  | 'module';

export interface Position {
  line: number; // 1-indexed
  column: number; // 0-indexed
}

export interface Range {
  start: Position;
  end: Position;
}

export interface ChunkMetadata {
  /** Unique stable identifier for this chunk */
  id: string;

  /** Type of chunk */
  type: ChunkType;

  /** Name of the chunk (function name, class name, etc.) */
  name: string;

  /** Full qualified name (e.g., "MyClass.myMethod") */
  qualifiedName: string;

  /** File path relative to project root */
  filePath: string;

  /** Start and end positions */
  range: Range;

  /** Start and end line numbers (1-indexed) */
  startLine: number;
  endLine: number;

  /** Content hash for change detection */
  hash: string;

  /** Dependencies: imports and references */
  dependencies: Dependency[];

  /** Parent chunk ID (if nested) */
  parentId?: string;

  /** Child chunk IDs */
  childrenIds: string[];

  /** Whether this is exported */
  exported: boolean;

  /** Export name if exported */
  exportName?: string;

  /** Visibility modifier */
  visibility?: 'public' | 'private' | 'protected';

  /** Whether this is async */
  async?: boolean;

  /** Whether this is a generator */
  generator?: boolean;

  /** Decorators applied to this chunk */
  decorators: string[];

  /** Type parameters (generics) */
  typeParameters: string[];

  /** Parameters (for functions/methods) */
  parameters: Parameter[];

  /** Return type (for functions/methods) */
  returnType?: string;

  /** JSDoc comment if present */
  jsdoc?: string;

  /** Size in tokens (approximate) */
  tokenCount?: number;

  /** Vue-specific metadata */
  vueOptionType?:
    | 'method'
    | 'computed'
    | 'watcher'
    | 'data'
    | 'lifecycle-hook'
    | 'prop'
    | 'emit'
    | 'setup';
}

export interface Dependency {
  /** Imported symbol name */
  name: string;

  /** Source module path */
  source: string;

  /** Type: import, require, dynamic import */
  type: 'import' | 'require' | 'dynamic-import' | 'reference';

  /** Whether it's a default import */
  default?: boolean;

  /** Whether it's a namespace import */
  namespace?: boolean;
}

export interface Parameter {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface Chunk extends ChunkMetadata {
  /** The actual code content (only in memory, optional for memory efficiency) */
  content?: string;
}

export interface ChunkingOptions {
  /** Parser to use */
  parser?: ParserType;

  /** Maximum chunk size in tokens */
  chunkSize?: number;

  /** Overlap between chunks in tokens */
  overlap?: number;

  /** Whether to include nested chunks */
  includeNested?: boolean;

  /** Whether to merge small chunks */
  mergeSmallChunks?: boolean;

  /** Minimum chunk size in tokens */
  minChunkSize?: number;

  /** Project root directory */
  rootDir?: string;

  /** File patterns to include */
  include?: string[];

  /** File patterns to exclude */
  exclude?: string[];

  /** Whether to include code content in chunks (default: false for memory efficiency) */
  includeContent?: boolean;

  /** Maximum parser pool size (default: 5) */
  parserPoolSize?: number;

  /** AST cache TTL in milliseconds (default: 5 minutes) */
  astCacheTTL?: number;

  /** Maximum AST cache size (default: 1000) */
  astCacheMaxSize?: number;
}

export interface ChunkingResult {
  /** All chunks extracted */
  chunks: Chunk[];

  /** Dependency graph */
  dependencyGraph: DependencyGraph;

  /** Import/export map */
  importExportMap: ImportExportMap;

  /** Statistics */
  stats: ChunkingStats;
}

export interface DependencyGraph {
  /** Map from chunk ID to dependencies */
  [chunkId: string]: string[]; // Array of chunk IDs this chunk depends on
}

export interface FileRange {
  /** Start line number (1-indexed) */
  start: number;
  /** End line number (1-indexed, inclusive) */
  end: number;
}

export interface FileRangeRequest {
  /** File path relative to project root */
  filePath: string;
  /** One or more line ranges in this file */
  ranges: FileRange[];
}

export interface CodeExtractionResult {
  /** Chunks found in the specified ranges */
  selectedChunks: Chunk[];
  /** Dependent chunks (functions, variables, etc. that selected chunks depend on) */
  dependentChunks: Chunk[];
  /** All chunks combined (selected + dependencies) */
  allChunks: Chunk[];
  /** Complete code blocks organized by file */
  codeBlocks: Map<string, string>;
  /** Dependency graph showing relationships */
  dependencyGraph: DependencyGraph;
}

export interface ImportExportMap {
  /** Map from file path to exports */
  exports: Map<string, ExportInfo[]>;

  /** Map from file path to imports */
  imports: Map<string, ImportInfo[]>;
}

export interface ExportInfo {
  name: string;
  type: ChunkType;
  chunkId: string;
  default?: boolean;
}

export interface ImportInfo {
  name: string;
  source: string;
  default?: boolean;
  namespace?: boolean;
}

export interface ChunkingStats {
  totalFiles: number;
  totalChunks: number;
  chunksByType: Record<ChunkType, number>;
  averageChunkSize: number;
  totalTokens: number;
}

export interface ASTNode {
  type: string;
  range?: Range;
  /** Name of the node */
  name?: string;
  /** Language this node belongs to */
  language?: string;
  /** TypeScript-specific node (for TypeScript/Vue adapters) */
  _tsNode?: object;
  /** Tree-sitter-specific node (for Tree-sitter adapter) */
  _treeSitterNode?: object | null;
  /** Tree-sitter-specific tree (for Tree-sitter adapter) */
  _treeSitterTree?: object;
  /** Additional properties for parser-specific data */
  [key: string]: string | number | boolean | Range | ASTNode[] | object | null | undefined;
}

export interface ParserAdapter {
  /** Parse code into AST */
  parse(code: string, filePath: string): ASTNode;

  /** Get the root node of the AST */
  getRoot(node: ASTNode): ASTNode;

  /** Get all top-level declarations */
  getTopLevelDeclarations(node: ASTNode): ASTNode[];

  /** Check if node is a function declaration */
  isFunction(node: ASTNode): boolean;

  /** Check if node is a class declaration */
  isClass(node: ASTNode): boolean;

  /** Check if node is an interface declaration */
  isInterface(node: ASTNode): boolean;

  /** Check if node is an enum declaration */
  isEnum(node: ASTNode): boolean;

  /** Check if node is a type alias */
  isTypeAlias(node: ASTNode): boolean;

  /** Check if node is a namespace */
  isNamespace(node: ASTNode): boolean;

  /** Get node name */
  getNodeName(node: ASTNode): string | undefined;

  /** Get node range */
  getNodeRange(node: ASTNode): Range | undefined;

  /** Get node children */
  getChildren(node: ASTNode): ASTNode[];

  /** Check if node is exported */
  isExported(node: ASTNode): boolean;

  /** Get export name */
  getExportName(node: ASTNode): string | undefined;

  /** Get imports from AST */
  getImports(node: ASTNode): Dependency[];

  /** Get exports from AST */
  getExports(node: ASTNode): ExportInfo[];

  /** Get decorators */
  getDecorators(node: ASTNode): string[];

  /** Get type parameters */
  getTypeParameters(node: ASTNode): string[];

  /** Get parameters (for functions) */
  getParameters(node: ASTNode): Parameter[];

  /** Get return type */
  getReturnType(node: ASTNode): string | undefined;

  /** Get JSDoc comment */
  getJSDoc(node: ASTNode): string | undefined;

  /** Extract code for a node */
  extractCode(node: ASTNode, sourceCode?: string): string;
}
