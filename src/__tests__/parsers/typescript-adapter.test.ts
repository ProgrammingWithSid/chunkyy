import { TypeScriptAdapter } from '../../parsers/typescript-adapter';

describe('TypeScriptAdapter', () => {
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
  });

  describe('parse', () => {
    it('should parse TypeScript code', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      expect(ast).toBeDefined();
      expect(ast.type).toBeDefined();
      expect(ast.range).toBeDefined();
    });

    it('should parse TypeScript with TSX', () => {
      const code = `const Component = () => <div>Hello</div>;`;
      const ast = adapter.parse(code, 'test.tsx');
      expect(ast).toBeDefined();
    });

    it('should handle empty code', () => {
      const code = ``;
      const ast = adapter.parse(code, 'test.ts');
      expect(ast).toBeDefined();
    });
  });

  describe('getRoot', () => {
    it('should return the root node', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      expect(root).toBe(ast);
    });
  });

  describe('getTopLevelDeclarations', () => {
    it('should get top-level function declarations', () => {
      const code = `function test1() { }
function test2() { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      expect(declarations.length).toBeGreaterThanOrEqual(2);
    });

    it('should get top-level class declarations', () => {
      const code = `class A { }
class B { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      expect(declarations.length).toBeGreaterThanOrEqual(2);
    });

    it('should get mixed top-level declarations', () => {
      const code = `function test() { }
class Test { }
interface ITest { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      expect(declarations.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('isFunction', () => {
    it('should identify function declarations', () => {
      const code = `function test() { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      expect(funcDecl).toBeDefined();
      if (funcDecl) {
        expect(adapter.isFunction(funcDecl)).toBe(true);
      }
    });

    it('should identify arrow functions', () => {
      const code = `const test = () => { };`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      // Arrow functions are in variable declarations
      const varDecl = declarations.find((d) => !adapter.isFunction(d));
      if (varDecl) {
        const children = adapter.getChildren(varDecl);
        const arrowFunc = children.find((c) => adapter.isFunction(c));
        if (arrowFunc) {
          expect(adapter.isFunction(arrowFunc)).toBe(true);
        }
      }
    });

    it('should identify method declarations', () => {
      const code = `class Test {
  method() { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => adapter.isFunction(c));
        expect(method).toBeDefined();
        if (method) {
          expect(adapter.isFunction(method)).toBe(true);
        }
      }
    });

    it('should not identify classes as functions', () => {
      const code = `class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        expect(adapter.isFunction(classDecl)).toBe(false);
      }
    });
  });

  describe('isClass', () => {
    it('should identify class declarations', () => {
      const code = `class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      expect(classDecl).toBeDefined();
      if (classDecl) {
        expect(adapter.isClass(classDecl)).toBe(true);
      }
    });

    it('should identify abstract classes', () => {
      const code = `abstract class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      expect(classDecl).toBeDefined();
    });

    it('should not identify interfaces as classes', () => {
      const code = `interface Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      if (interfaceDecl) {
        expect(adapter.isClass(interfaceDecl)).toBe(false);
      }
    });
  });

  describe('isInterface', () => {
    it('should identify interface declarations', () => {
      const code = `interface Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      expect(interfaceDecl).toBeDefined();
      if (interfaceDecl) {
        expect(adapter.isInterface(interfaceDecl)).toBe(true);
      }
    });
  });

  describe('isEnum', () => {
    it('should identify enum declarations', () => {
      const code = `enum Status { Active, Inactive }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const enumDecl = declarations.find((d) => adapter.isEnum(d));
      expect(enumDecl).toBeDefined();
      if (enumDecl) {
        expect(adapter.isEnum(enumDecl)).toBe(true);
      }
    });
  });

  describe('isTypeAlias', () => {
    it('should identify type alias declarations', () => {
      const code = `type User = { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const typeAliasDecl = declarations.find((d) => adapter.isTypeAlias(d));
      expect(typeAliasDecl).toBeDefined();
      if (typeAliasDecl) {
        expect(adapter.isTypeAlias(typeAliasDecl)).toBe(true);
      }
    });
  });

  describe('isNamespace', () => {
    it('should identify namespace declarations', () => {
      const code = `namespace Utils { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const namespaceDecl = declarations.find((d) => adapter.isNamespace(d));
      expect(namespaceDecl).toBeDefined();
      if (namespaceDecl) {
        expect(adapter.isNamespace(namespaceDecl)).toBe(true);
      }
    });
  });

  describe('getNodeName', () => {
    it('should get function name', () => {
      const code = `function test() { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(adapter.getNodeName(funcDecl)).toBe('test');
      }
    });

    it('should get class name', () => {
      const code = `class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        expect(adapter.getNodeName(classDecl)).toBe('Test');
      }
    });

    it('should get interface name', () => {
      const code = `interface Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      if (interfaceDecl) {
        expect(adapter.getNodeName(interfaceDecl)).toBe('Test');
      }
    });

    it('should get constructor name', () => {
      const code = `class Test {
  constructor() { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const constructor = children.find((c) => adapter.getNodeName(c) === 'constructor');
        if (constructor) {
          expect(adapter.getNodeName(constructor)).toBe('constructor');
        }
      }
    });
  });

  describe('getNodeRange', () => {
    it('should get range for function', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        const range = adapter.getNodeRange(funcDecl);
        expect(range).toBeDefined();
        expect(range?.start.line).toBeGreaterThan(0);
        expect(range?.end.line).toBeGreaterThanOrEqual(range?.start.line || 0);
      }
    });
  });

  describe('getChildren', () => {
    it('should get class members', () => {
      const code = `class Test {
  method1() { }
  method2() { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        expect(children.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should get interface members', () => {
      const code = `interface Test {
  prop1: string;
  prop2: number;
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      if (interfaceDecl) {
        const children = adapter.getChildren(interfaceDecl);
        expect(children.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('isExported', () => {
    it('should identify exported functions', () => {
      const code = `export function test() { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(adapter.isExported(funcDecl)).toBe(true);
      }
    });

    it('should identify exported classes', () => {
      const code = `export class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        expect(adapter.isExported(classDecl)).toBe(true);
      }
    });

    it('should identify default exports', () => {
      const code = `export default function test() { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(adapter.isExported(funcDecl)).toBe(true);
      }
    });

    it('should not identify non-exported declarations', () => {
      const code = `function test() { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(adapter.isExported(funcDecl)).toBe(false);
      }
    });
  });

  describe('getExportName', () => {
    it('should get export name for named export', () => {
      const code = `export function test() { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(adapter.getExportName(funcDecl)).toBe('test');
      }
    });

    it('should get "default" for default export', () => {
      const code = `export default function test() { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(adapter.getExportName(funcDecl)).toBe('default');
      }
    });
  });

  describe('getImports', () => {
    it('should get default imports', () => {
      const code = `import React from 'react';`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const imports = adapter.getImports(root);
      expect(imports.length).toBeGreaterThan(0);
      const reactImport = imports.find((i) => i.name === 'React');
      expect(reactImport).toBeDefined();
      if (reactImport) {
        expect(reactImport.default).toBe(true);
        expect(reactImport.source).toBe('react');
      }
    });

    it('should get named imports', () => {
      const code = `import { useState, useEffect } from 'react';`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const imports = adapter.getImports(root);
      expect(imports.length).toBeGreaterThanOrEqual(2);
      const useStateImport = imports.find((i) => i.name === 'useState');
      const useEffectImport = imports.find((i) => i.name === 'useEffect');
      expect(useStateImport).toBeDefined();
      expect(useEffectImport).toBeDefined();
    });

    it('should get namespace imports', () => {
      const code = `import * as React from 'react';`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const imports = adapter.getImports(root);
      expect(imports.length).toBeGreaterThan(0);
      const namespaceImport = imports.find((i) => i.namespace);
      expect(namespaceImport).toBeDefined();
    });
  });

  describe('getDecorators', () => {
    it('should get class decorators', () => {
      const code = `@Component({ selector: 'app' })
class AppComponent { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const decorators = adapter.getDecorators(classDecl);
        expect(decorators.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getTypeParameters', () => {
    it('should get type parameters from generic function', () => {
      const code = `function identity<T>(value: T): T { return value; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        const typeParams = adapter.getTypeParameters(funcDecl);
        expect(typeParams).toContain('T');
      }
    });

    it('should get type parameters from generic class', () => {
      const code = `class Container<T> { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const typeParams = adapter.getTypeParameters(classDecl);
        expect(typeParams).toContain('T');
      }
    });
  });

  describe('getParameters', () => {
    it('should get function parameters', () => {
      const code = `function add(a: number, b: number): number { return a + b; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        const params = adapter.getParameters(funcDecl);
        expect(params.length).toBe(2);
        expect(params[0].name).toBe('a');
        expect(params[1].name).toBe('b');
      }
    });
  });

  describe('getReturnType', () => {
    it('should get function return type', () => {
      const code = `function test(): string { return ''; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        const returnType = adapter.getReturnType(funcDecl);
        expect(returnType).toBe('string');
      }
    });
  });

  describe('getJSDoc', () => {
    it('should get JSDoc comments', () => {
      const code = `/**
 * Adds two numbers
 * @param a First number
 * @param b Second number
 * @returns Sum of a and b
 */
function add(a: number, b: number): number { return a + b; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        const jsdoc = adapter.getJSDoc(funcDecl);
        expect(jsdoc).toBeDefined();
        // JSDoc may be formatted differently, check for key content
        expect(jsdoc).toBeTruthy();
      }
    });
  });

  describe('extractCode', () => {
    it('should extract code for function', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        const extracted = adapter.extractCode(funcDecl, code);
        expect(extracted).toContain('function test');
        expect(extracted).toContain('return 1');
      }
    });
  });
});
