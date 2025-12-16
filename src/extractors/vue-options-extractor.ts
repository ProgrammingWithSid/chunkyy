import * as ts from 'typescript';
import { ASTNode, Chunk, ChunkType } from '../types';
import { createASTNodeFromTS, getTypeScriptNode } from '../utils/type-guards';
import { BaseExtractor } from './base-extractor';

/**
 * Vue Options API property names
 */
const VUE_OPTIONS_API_PROPERTIES = [
  'data',
  'methods',
  'computed',
  'watch',
  'props',
  'emits',
  'setup',
  // Lifecycle hooks
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeUnmount',
  'unmounted',
  'beforeDestroy',
  'destroyed',
  'activated',
  'deactivated',
  'errorCaptured',
  'renderTracked',
  'renderTriggered',
];

/**
 * Extracts Vue Options API component options
 * Handles methods, computed properties, data functions, and lifecycle hooks
 */
export class VueOptionsExtractor extends BaseExtractor {
  canHandle(node: ASTNode): boolean {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return false;

    // Handle ExportAssignment (export default { ... })
    if (ts.isExportAssignment(tsNode) && tsNode.expression) {
      if (ts.isObjectLiteralExpression(tsNode.expression)) {
        // Check if any property is a Vue option
        for (const prop of tsNode.expression.properties) {
          if (ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop)) {
            const name = ts.isPropertyAssignment(prop) ? prop.name : prop.name;
            if (ts.isIdentifier(name)) {
              if (VUE_OPTIONS_API_PROPERTIES.includes(name.text)) {
                return true;
              }
            }
          }
        }
      }
    }

    // Check if this is a property in a Vue Options API object
    // TypeScript parses object methods as MethodDeclaration, not PropertyAssignment
    if (ts.isMethodDeclaration(tsNode)) {
      const name = tsNode.name;
      if (ts.isIdentifier(name)) {
        const propName = name.text;
        return VUE_OPTIONS_API_PROPERTIES.includes(propName);
      }
    }

    // Also check PropertyAssignment for cases like methods: { ... }
    if (ts.isPropertyAssignment(tsNode)) {
      const name = tsNode.name;
      if (ts.isIdentifier(name)) {
        const propName = name.text;
        return VUE_OPTIONS_API_PROPERTIES.includes(propName);
      }
    }

    return false;
  }

  getChunkType(): ChunkType {
    return 'method'; // Treat Vue options as methods for consistency
  }

  extract(node: ASTNode, sourceCode: string, filePath: string): Chunk[] {
    const tsNode = getTypeScriptNode(node);
    if (!tsNode) return [];

    let propName: string | undefined;

    // Handle ExportAssignment (export default { methods: { ... }, computed: { ... } })
    if (ts.isExportAssignment(tsNode) && tsNode.expression) {
      if (ts.isObjectLiteralExpression(tsNode.expression)) {
        const chunks: Chunk[] = [];
        // Extract all Vue options from the export default object
        for (const prop of tsNode.expression.properties) {
          if (ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop)) {
            const propNode = createASTNodeFromTS(prop);
            const extracted = this.extract(propNode, sourceCode, filePath);
            chunks.push(...extracted);
          }
        }
        return chunks;
      }
    }

    // Handle MethodDeclaration (data(), created(), etc.)
    if (ts.isMethodDeclaration(tsNode)) {
      const nameNode = tsNode.name;
      if (!ts.isIdentifier(nameNode)) {
        return [];
      }
      propName = nameNode.text;

      // Determine if it's a lifecycle hook or data function
      const lifecycleHooks = [
        'beforeCreate',
        'created',
        'beforeMount',
        'mounted',
        'beforeUpdate',
        'updated',
        'beforeUnmount',
        'unmounted',
        'beforeDestroy',
        'destroyed',
        'activated',
        'deactivated',
        'errorCaptured',
        'renderTracked',
        'renderTriggered',
      ];

      const vueOptionType =
        propName === 'data'
          ? 'data'
          : lifecycleHooks.includes(propName)
            ? 'lifecycle-hook'
            : 'method';

      const astNode = createASTNodeFromTS(tsNode);
      const range = this.adapter.getNodeRange(astNode);
      if (!range) return [];

      const chunk = this.createChunk(
        astNode,
        sourceCode,
        filePath,
        propName,
        propName,
        'function',
        undefined
      );

      chunk.vueOptionType = vueOptionType;
      return [chunk];
    }

    // Handle PropertyAssignment (methods: { ... }, computed: { ... }, etc.)
    if (!ts.isPropertyAssignment(tsNode)) {
      return [];
    }

    const nameNode = tsNode.name;
    if (!ts.isIdentifier(nameNode)) {
      return [];
    }

    propName = nameNode.text;
    const initializer = tsNode.initializer;

    if (!initializer) {
      return [];
    }

    const chunks: Chunk[] = [];

    // Handle different Vue option types
    if (propName === 'methods' && ts.isObjectLiteralExpression(initializer)) {
      // Extract individual methods from methods object
      chunks.push(...this.extractMethodsFromObject(initializer, sourceCode, filePath, propName));
    } else if (propName === 'computed' && ts.isObjectLiteralExpression(initializer)) {
      // Extract computed properties
      chunks.push(...this.extractComputedFromObject(initializer, sourceCode, filePath, propName));
    } else if (propName === 'watch' && ts.isObjectLiteralExpression(initializer)) {
      // Extract watchers
      chunks.push(...this.extractWatchersFromObject(initializer, sourceCode, filePath, propName));
    } else if (
      propName === 'data' &&
      (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer))
    ) {
      // Extract data function
      chunks.push(...this.extractDataFunction(initializer, sourceCode, filePath, propName));
    } else if (propName === 'props' && ts.isObjectLiteralExpression(initializer)) {
      // Extract props
      chunks.push(...this.extractPropsFromObject(initializer, sourceCode, filePath, propName));
    } else if (
      propName === 'emits' &&
      (ts.isArrayLiteralExpression(initializer) || ts.isObjectLiteralExpression(initializer))
    ) {
      // Extract emits
      chunks.push(...this.extractEmits(initializer, sourceCode, filePath, propName));
    } else if (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer)) {
      // Lifecycle hooks and other function options
      chunks.push(...this.extractFunctionOption(initializer, sourceCode, filePath, propName));
    }

    return chunks;
  }

  /**
   * Extract methods from methods object
   */
  private extractMethodsFromObject(
    objLiteral: ts.ObjectLiteralExpression,
    sourceCode: string,
    filePath: string,
    parentName: string
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (const property of objLiteral.properties) {
      if (ts.isMethodDeclaration(property) || ts.isPropertyAssignment(property)) {
        const methodName = this.getPropertyName(property);
        if (!methodName) continue;

        const methodNode = ts.isPropertyAssignment(property) ? property.initializer : property;

        if (
          ts.isFunctionExpression(methodNode) ||
          ts.isArrowFunction(methodNode) ||
          ts.isMethodDeclaration(property)
        ) {
          const qualifiedName = `${parentName}.${methodName}`;
          const propertyNode = createASTNodeFromTS(property);
          const range = this.adapter.getNodeRange(propertyNode);

          if (range) {
            const chunk = this.createChunk(
              propertyNode,
              sourceCode,
              filePath,
              methodName,
              qualifiedName,
              'method',
              parentName
            );
            chunk.vueOptionType = 'method';
            chunks.push(chunk);
          }
        }
      }
    }

    return chunks;
  }

  /**
   * Extract computed properties from computed object
   */
  private extractComputedFromObject(
    objLiteral: ts.ObjectLiteralExpression,
    sourceCode: string,
    filePath: string,
    parentName: string
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (const property of objLiteral.properties) {
      const propName = this.getPropertyName(property);
      if (!propName) continue;

      const qualifiedName = `${parentName}.${propName}`;
      const propertyNode = createASTNodeFromTS(property);
      const range = this.adapter.getNodeRange(propertyNode);

      if (range) {
        const chunk = this.createChunk(
          propertyNode,
          sourceCode,
          filePath,
          propName,
          qualifiedName,
          'method', // Treat computed as methods
          parentName
        );
        chunk.vueOptionType = 'computed';
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Extract data function
   */
  private extractDataFunction(
    func: ts.FunctionExpression | ts.ArrowFunction,
    sourceCode: string,
    filePath: string,
    parentName: string
  ): Chunk[] {
    const funcNode = createASTNodeFromTS(func);
    const range = this.adapter.getNodeRange(funcNode);
    if (!range) return [];

    const chunk = this.createChunk(
      funcNode,
      sourceCode,
      filePath,
      'data',
      `${parentName}.data`,
      'function',
      parentName
    );
    chunk.vueOptionType = 'data';
    return [chunk];
  }

  /**
   * Extract function option (lifecycle hooks, etc.)
   */
  private extractFunctionOption(
    func: ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration,
    sourceCode: string,
    filePath: string,
    propName: string
  ): Chunk[] {
    const funcNode = createASTNodeFromTS(func);
    const range = this.adapter.getNodeRange(funcNode);
    if (!range) return [];

    const chunk = this.createChunk(
      funcNode,
      sourceCode,
      filePath,
      propName,
      propName,
      'function',
      undefined
    );

    // Determine if it's a lifecycle hook
    const lifecycleHooks = [
      'beforeCreate',
      'created',
      'beforeMount',
      'mounted',
      'beforeUpdate',
      'updated',
      'beforeUnmount',
      'unmounted',
      'beforeDestroy',
      'destroyed',
      'activated',
      'deactivated',
      'errorCaptured',
      'renderTracked',
      'renderTriggered',
    ];

    chunk.vueOptionType = lifecycleHooks.includes(propName) ? 'lifecycle-hook' : 'method';
    return [chunk];
  }

  /**
   * Extract watchers from watch object
   */
  private extractWatchersFromObject(
    objLiteral: ts.ObjectLiteralExpression,
    sourceCode: string,
    filePath: string,
    parentName: string
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (const property of objLiteral.properties) {
      const propName = this.getPropertyName(property);
      if (!propName) continue;

      const qualifiedName = `${parentName}.${propName}`;
      const propertyNode = createASTNodeFromTS(property);
      const range = this.adapter.getNodeRange(propertyNode);

      if (range) {
        const chunk = this.createChunk(
          propertyNode,
          sourceCode,
          filePath,
          propName,
          qualifiedName,
          'method',
          parentName
        );
        chunk.vueOptionType = 'watcher';
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Extract props from props object
   */
  private extractPropsFromObject(
    objLiteral: ts.ObjectLiteralExpression,
    sourceCode: string,
    filePath: string,
    parentName: string
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (const property of objLiteral.properties) {
      const propName = this.getPropertyName(property);
      if (!propName) continue;

      const qualifiedName = `${parentName}.${propName}`;
      const propertyNode = createASTNodeFromTS(property);
      const range = this.adapter.getNodeRange(propertyNode);

      if (range) {
        const chunk = this.createChunk(
          propertyNode,
          sourceCode,
          filePath,
          propName,
          qualifiedName,
          'top-level-declaration',
          parentName
        );
        chunk.vueOptionType = 'prop';
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Extract emits (can be array or object)
   */
  private extractEmits(
    initializer: ts.ArrayLiteralExpression | ts.ObjectLiteralExpression,
    sourceCode: string,
    filePath: string,
    parentName: string
  ): Chunk[] {
    const chunks: Chunk[] = [];

    if (ts.isArrayLiteralExpression(initializer)) {
      // Array format: ['event1', 'event2']
      for (const element of initializer.elements) {
        if (ts.isStringLiteral(element)) {
          const emitName = element.text;
          const elementNode = createASTNodeFromTS(element);
          const range = this.adapter.getNodeRange(elementNode);
          if (range) {
            const chunk = this.createChunk(
              elementNode,
              sourceCode,
              filePath,
              emitName,
              `${parentName}.${emitName}`,
              'top-level-declaration',
              parentName
            );
            chunk.vueOptionType = 'emit';
            chunks.push(chunk);
          }
        }
      }
    } else if (ts.isObjectLiteralExpression(initializer)) {
      // Object format: { event1: validator, event2: validator }
      for (const property of initializer.properties) {
        const propName = this.getPropertyName(property);
        if (!propName) continue;

        const qualifiedName = `${parentName}.${propName}`;
        const propertyNode = createASTNodeFromTS(property);
        const range = this.adapter.getNodeRange(propertyNode);

        if (range) {
          const chunk = this.createChunk(
            propertyNode,
            sourceCode,
            filePath,
            propName,
            qualifiedName,
            'top-level-declaration',
            parentName
          );
          chunk.vueOptionType = 'emit';
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  }

  /**
   * Get property name from a property assignment or method declaration
   */
  private getPropertyName(property: ts.ObjectLiteralElement): string | undefined {
    if (ts.isPropertyAssignment(property)) {
      const name = property.name;
      if (ts.isIdentifier(name)) {
        return name.text;
      }
    } else if (ts.isMethodDeclaration(property)) {
      const name = property.name;
      if (ts.isIdentifier(name)) {
        return name.text;
      }
    }
    return undefined;
  }
}
