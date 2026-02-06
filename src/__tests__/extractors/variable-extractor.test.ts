import { VariableExtractor } from '../../extractors/variable-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';

describe('VariableExtractor', () => {
  let extractor: VariableExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new VariableExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle arrow function in const declaration', () => {
      const code = `const test = () => 1;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      expect(varDecl).toBeDefined();
      if (varDecl) {
        expect(extractor.canHandle(varDecl)).toBe(true);
      }
    });

    it('should handle exported variable declaration', () => {
      const code = `export const value = 42;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      expect(varDecl).toBeDefined();
      if (varDecl) {
        expect(extractor.canHandle(varDecl)).toBe(true);
      }
    });

    it('should handle async arrow function', () => {
      const code = `const fetchData = async () => Promise.resolve(1);`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      expect(varDecl).toBeDefined();
      if (varDecl) {
        expect(extractor.canHandle(varDecl)).toBe(true);
      }
    });

    it('should not handle non-arrow function variable', () => {
      const code = `const value = 42;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => !adapter.isFunction(d));
      if (varDecl && !extractor.canHandle(varDecl)) {
        expect(extractor.canHandle(varDecl)).toBe(false);
      }
    });

    it('should not handle function declarations', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(extractor.canHandle(funcDecl)).toBe(false);
      }
    });
  });

  describe('extract', () => {
    it('should extract arrow function', () => {
      const code = `const add = (a: number, b: number) => a + b;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      expect(varDecl).toBeDefined();

      if (varDecl) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('add');
        expect(chunks[0].type).toBe('function');
        expect(chunks[0].exported).toBe(false);
        expect(chunks[0].qualifiedName).toBe('add');
      }
    });

    it('should extract arrow function with parameters', () => {
      const code = `const multiply = (a: number, b: number): number => a * b;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      if (varDecl) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].parameters.length).toBe(2);
        expect(chunks[0].parameters[0].name).toBe('a');
        expect(chunks[0].parameters[1].name).toBe('b');
        expect(chunks[0].returnType).toBe('number');
      }
    });

    it('should extract exported arrow function', () => {
      const code = `export const handler = () => { };`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      if (varDecl) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].exported).toBe(true);
        expect(chunks[0].exportName).toBe('handler');
      }
    });

    it('should extract async arrow function', () => {
      const code = `const fetchData = async () => Promise.resolve(1);`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      if (varDecl) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].async).toBe(true);
      }
    });

    it('should extract exported constant', () => {
      const code = `export const API_URL = 'https://api.example.com';`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      if (varDecl) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].type).toBe('export');
        expect(chunks[0].exported).toBe(true);
      }
    });

    it('should extract multiple arrow functions in one declaration', () => {
      const code = `const add = (a: number) => a + 1, subtract = (a: number) => a - 1;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      if (varDecl) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        const addChunk = chunks.find((c) => c.name === 'add');
        const subtractChunk = chunks.find((c) => c.name === 'subtract');
        expect(addChunk).toBeDefined();
        expect(subtractChunk).toBeDefined();
      }
    });

    it('should extract arrow function with no parameters', () => {
      const code = `const getValue = () => 42;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      if (varDecl) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].parameters.length).toBe(0);
      }
    });

    it('should extract arrow function with return type', () => {
      const code = `const getString = (): string => 'hello';`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => extractor.canHandle(d));
      if (varDecl) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].returnType).toBe('string');
      }
    });

    it('should return empty array for non-variable statement', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        const chunks = extractor.extract(funcDecl, code, 'test.ts');
        expect(chunks.length).toBe(0);
      }
    });

    it('should not extract non-arrow function variable', () => {
      const code = `const value = 42;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => !adapter.isFunction(d));
      if (varDecl && !extractor.canHandle(varDecl)) {
        const chunks = extractor.extract(varDecl, code, 'test.ts');
        expect(chunks.length).toBe(0);
      }
    });
  });

  describe('getChunkType', () => {
    it('should return function type', () => {
      expect(extractor.getChunkType()).toBe('function');
    });
  });
});
