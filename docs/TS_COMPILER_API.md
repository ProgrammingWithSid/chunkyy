# Using TypeScript Compiler API

This guide explains how Chunkyyy uses the TypeScript Compiler API to walk ASTs and extract semantic chunks.

## Overview

The TypeScript Compiler API provides programmatic access to TypeScript's parser and type checker. Chunkyyy uses it to:
1. Parse TypeScript/JavaScript code into ASTs
2. Traverse AST nodes
3. Extract semantic information
4. Identify chunk boundaries

## Key Concepts

### SourceFile

The root of the AST is a `SourceFile` node:

```typescript
import * as ts from 'typescript';

const sourceFile = ts.createSourceFile(
  'file.ts',
  sourceCode,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
```

### Node Types

TypeScript AST nodes have specific types:
- `ts.FunctionDeclaration`: Function declarations
- `ts.ClassDeclaration`: Class declarations
- `ts.InterfaceDeclaration`: Interface declarations
- `ts.EnumDeclaration`: Enum declarations
- `ts.MethodDeclaration`: Class methods
- `ts.VariableDeclaration`: Variable declarations

### Type Guards

Use type guards to check node types:

```typescript
if (ts.isFunctionDeclaration(node)) {
  // Handle function
}

if (ts.isClassDeclaration(node)) {
  // Handle class
}
```

## Walking the AST

### Top-Level Declarations

```typescript
const sourceFile = ts.createSourceFile(/* ... */);

// Get all top-level statements
for (const statement of sourceFile.statements) {
  if (ts.isFunctionDeclaration(statement)) {
    // Extract function
  } else if (ts.isClassDeclaration(statement)) {
    // Extract class
  }
}
```

### Recursive Traversal

```typescript
function traverse(node: ts.Node, callback: (node: ts.Node) => void) {
  callback(node);
  ts.forEachChild(node, child => traverse(child, callback));
}
```

### Finding Specific Nodes

```typescript
function findFunctions(node: ts.Node): ts.FunctionDeclaration[] {
  const functions: ts.FunctionDeclaration[] = [];

  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n)) {
      functions.push(n);
    }
    ts.forEachChild(n, visit);
  }

  visit(node);
  return functions;
}
```

## Extracting Node Information

### Node Name

```typescript
function getNodeName(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    return node.name?.getText(sourceFile);
  }
  return undefined;
}
```

### Node Range

```typescript
function getNodeRange(node: ts.Node, sourceFile: ts.SourceFile): Range {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

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
}
```

### Node Text

```typescript
function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
  return sourceFile.text.substring(node.getStart(), node.getEnd());
}
```

## Detecting Chunk Boundaries

### Function Boundaries

```typescript
function extractFunction(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile) {
  const start = node.getStart();
  const end = node.getEnd();
  const content = sourceFile.text.substring(start, end);

  return {
    name: node.name?.getText(sourceFile),
    startLine: sourceFile.getLineAndCharacterOfPosition(start).line + 1,
    endLine: sourceFile.getLineAndCharacterOfPosition(end).line + 1,
    content,
  };
}
```

### Class Boundaries

```typescript
function extractClass(node: ts.ClassDeclaration, sourceFile: ts.SourceFile) {
  const start = node.getStart();
  const end = node.getEnd();

  // Extract class body
  const members = node.members.map(member => {
    if (ts.isMethodDeclaration(member)) {
      return extractMethod(member, sourceFile);
    }
    // Handle other members
  });

  return {
    name: node.name?.getText(sourceFile),
    startLine: sourceFile.getLineAndCharacterOfPosition(start).line + 1,
    endLine: sourceFile.getLineAndCharacterOfPosition(end).line + 1,
    members,
  };
}
```

## Extracting Metadata

### Modifiers

```typescript
function getModifiers(node: ts.Node): ts.Modifier[] {
  if (ts.canHaveModifiers(node)) {
    return ts.getModifiers(node) || [];
  }
  return [];
}

function isExported(node: ts.Node): boolean {
  const modifiers = getModifiers(node);
  return modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isAsync(node: ts.Node): boolean {
  const modifiers = getModifiers(node);
  return modifiers.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
}
```

### Type Parameters

```typescript
function getTypeParameters(node: ts.Node): string[] {
  let typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined;

  if (ts.isFunctionDeclaration(node)) {
    typeParams = node.typeParameters;
  } else if (ts.isClassDeclaration(node)) {
    typeParams = node.typeParameters;
  }

  if (!typeParams) return [];

  return typeParams.map(tp => tp.name.getText());
}
```

### Parameters

```typescript
function getParameters(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile) {
  return node.parameters.map(param => ({
    name: param.name.getText(sourceFile),
    type: param.type?.getText(sourceFile),
    optional: param.questionToken !== undefined,
    defaultValue: param.initializer?.getText(sourceFile),
  }));
}
```

### Return Type

```typescript
function getReturnType(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile): string | undefined {
  return node.type?.getText(sourceFile);
}
```

## Extracting Imports

```typescript
function extractImports(sourceFile: ts.SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const source = moduleSpecifier.text;

        if (node.importClause) {
          // Default import
          if (node.importClause.name) {
            imports.push({
              name: node.importClause.name.getText(sourceFile),
              source,
              default: true,
            });
          }

          // Named imports
          if (node.importClause.namedBindings) {
            if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              imports.push({
                name: node.importClause.namedBindings.name.getText(sourceFile),
                source,
                namespace: true,
              });
            } else if (ts.isNamedImports(node.importClause.namedBindings)) {
              for (const element of node.importClause.namedBindings.elements) {
                imports.push({
                  name: element.name.getText(sourceFile),
                  source,
                  default: false,
                });
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}
```

## Extracting Exports

```typescript
function extractExports(sourceFile: ts.SourceFile): ExportInfo[] {
  const exports: ExportInfo[] = [];

  function visit(node: ts.Node) {
    // Direct exports
    if (ts.isFunctionDeclaration(node) && isExported(node)) {
      exports.push({
        name: node.name?.getText(sourceFile),
        type: 'function',
      });
    }

    // Export declarations
    if (ts.isExportDeclaration(node)) {
      // Handle named exports
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}
```

## Handling Edge Cases

### Arrow Functions

```typescript
function isArrowFunction(node: ts.Node): boolean {
  return ts.isArrowFunction(node) ||
         (ts.isVariableDeclaration(node) &&
          node.initializer &&
          ts.isArrowFunction(node.initializer));
}
```

### Decorators

```typescript
function getDecorators(node: ts.Node, sourceFile: ts.SourceFile): string[] {
  if (!ts.canHaveDecorators(node)) return [];

  const decorators = ts.getDecorators(node);
  if (!decorators) return [];

  return decorators.map(d => {
    if (ts.isCallExpression(d.expression)) {
      return d.expression.expression.getText(sourceFile);
    }
    return d.expression.getText(sourceFile);
  });
}
```

### JSDoc Comments

```typescript
function getJSDoc(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const jsDocTags = ts.getJSDocTags(node);

  if (jsDocTags.length > 0) {
    return jsDocTags.map(tag => tag.getText(sourceFile)).join('\n');
  }

  // Also check for JSDoc comments
  const comments = ts.getLeadingCommentRanges(
    sourceFile.text,
    node.getFullStart()
  );

  if (comments) {
    for (const comment of comments) {
      if (comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
        const text = sourceFile.text.substring(comment.pos, comment.end);
        if (text.startsWith('/**')) {
          return text;
        }
      }
    }
  }

  return undefined;
}
```

## Best Practices

1. **Use Type Guards**: Always use `ts.isXxx()` functions to check node types
2. **Handle Optional Properties**: Many nodes have optional properties (e.g., `node.name`)
3. **Preserve Source Positions**: Use `getStart()` and `getEnd()` for accurate ranges
4. **Traverse Recursively**: Use `ts.forEachChild()` for recursive traversal
5. **Extract Text Correctly**: Use `sourceFile.text.substring(start, end)` for node text

## Resources

- [TypeScript Compiler API Documentation](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [TypeScript AST Viewer](https://astexplorer.net/)
- [TypeScript Source Code](https://github.com/microsoft/TypeScript)
