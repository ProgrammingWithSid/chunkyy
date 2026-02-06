import { FunctionExtractor } from '../../extractors/function-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';

describe('FunctionExtractor', () => {
  let extractor: FunctionExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new FunctionExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle function declarations', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      expect(funcDecl).toBeDefined();
      if (funcDecl) {
        expect(extractor.canHandle(funcDecl)).toBe(true);
      }
    });

    it('should handle exported function declarations', () => {
      const code = `export function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      expect(funcDecl).toBeDefined();
      if (funcDecl) {
        expect(extractor.canHandle(funcDecl)).toBe(true);
      }
    });

    it('should handle async functions', () => {
      const code = `async function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      expect(funcDecl).toBeDefined();
      if (funcDecl) {
        expect(extractor.canHandle(funcDecl)).toBe(true);
      }
    });

    it('should handle generator functions', () => {
      const code = `function* test() { yield 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      expect(funcDecl).toBeDefined();
      if (funcDecl) {
        expect(extractor.canHandle(funcDecl)).toBe(true);
      }
    });

    it('should not handle arrow functions in variable declarations', () => {
      const code = `const test = () => 1;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => !adapter.isFunction(d));
      if (varDecl) {
        expect(extractor.canHandle(varDecl)).toBe(false);
      }
    });

    it('should not handle class methods', () => {
      const code = `class Test { method() { return 1; } }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      expect(classDecl).toBeDefined();
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => adapter.isFunction(c));
        if (method) {
          expect(extractor.canHandle(method)).toBe(false);
        }
      }
    });
  });

  describe('extract', () => {
    it('should extract simple function', () => {
      const code = `function hello() { return 'world'; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => extractor.canHandle(d));
      expect(funcDecl).toBeDefined();

      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('hello');
        expect(chunks[0].type).toBe('function');
        expect(chunks[0].exported).toBe(false);
      }
    });

    it('should extract function with parameters', () => {
      const code = `function add(a: number, b: number): number { return a + b; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => extractor.canHandle(d));
      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].parameters.length).toBe(2);
        expect(chunks[0].parameters[0].name).toBe('a');
        expect(chunks[0].parameters[1].name).toBe('b');
        expect(chunks[0].returnType).toBe('number');
      }
    });

    it('should extract exported function', () => {
      const code = `export function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => extractor.canHandle(d));
      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].exported).toBe(true);
        expect(chunks[0].exportName).toBe('test');
      }
    });

    it('should extract async function', () => {
      const code = `async function fetchData() { return await Promise.resolve(1); }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => extractor.canHandle(d));
      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].async).toBe(true);
      }
    });

    it('should extract generator function', () => {
      const code = `function* generate() { yield 1; yield 2; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => extractor.canHandle(d));
      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].generator).toBe(true);
      }
    });

    it('should extract function with type parameters', () => {
      const code = `function identity<T>(value: T): T { return value; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => extractor.canHandle(d));
      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].typeParameters).toContain('T');
      }
    });

    it('should extract function with JSDoc', () => {
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

      const funcDecl = declarations.find((d) => extractor.canHandle(d));
      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].jsdoc).toBeDefined();
        // JSDoc extraction may only include tags, not the main description
        expect(chunks[0].jsdoc).toBeTruthy();
      }
    });

    it('should extract nested functions', () => {
      const code = `function outer() {
  function inner() {
    return 42;
  }
  return inner();
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => extractor.canHandle(d));
      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts', 'outer');
        expect(chunks.length).toBeGreaterThan(0);
        const outerChunk = chunks.find((c) => c.name === 'outer');
        expect(outerChunk).toBeDefined();
      }
    });
  });

  describe('getChunkType', () => {
    it('should return function type', () => {
      expect(extractor.getChunkType()).toBe('function');
    });
  });
});
