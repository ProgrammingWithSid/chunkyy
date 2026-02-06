import { ClassExtractor } from '../../extractors/class-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';

describe('ClassExtractor', () => {
  let extractor: ClassExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new ClassExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle class declarations', () => {
      const code = `class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      expect(classDecl).toBeDefined();
      if (classDecl) {
        expect(extractor.canHandle(classDecl)).toBe(true);
      }
    });

    it('should handle exported classes', () => {
      const code = `export class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      expect(classDecl).toBeDefined();
      if (classDecl) {
        expect(extractor.canHandle(classDecl)).toBe(true);
      }
    });

    it('should handle abstract classes', () => {
      const code = `abstract class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      expect(classDecl).toBeDefined();
      if (classDecl) {
        expect(extractor.canHandle(classDecl)).toBe(true);
      }
    });

    it('should not handle interfaces', () => {
      const code = `interface Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      if (interfaceDecl) {
        expect(extractor.canHandle(interfaceDecl)).toBe(false);
      }
    });
  });

  describe('extract', () => {
    it('should extract simple class', () => {
      const code = `class Calculator { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => extractor.canHandle(d));
      if (classDecl) {
        const chunks = extractor.extract(classDecl, code, 'test.ts');
        expect(chunks.length).toBeGreaterThan(0);
        const classChunk = chunks.find((c) => c.type === 'class');
        expect(classChunk).toBeDefined();
        expect(classChunk?.name).toBe('Calculator');
      }
    });

    it('should extract class with methods', () => {
      const code = `class Calculator {
  add(a: number, b: number): number { return a + b; }
  subtract(a: number, b: number): number { return a - b; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => extractor.canHandle(d));
      if (classDecl) {
        const chunks = extractor.extract(classDecl, code, 'test.ts');
        const classChunk = chunks.find((c) => c.type === 'class');
        expect(classChunk).toBeDefined();

        const methodChunks = chunks.filter((c) => c.type === 'method');
        expect(methodChunks.length).toBe(2);
        expect(methodChunks[0].parentId).toBe(classChunk?.id);
      }
    });

    it('should extract class with constructor', () => {
      const code = `class Test {
  constructor(private value: number) { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => extractor.canHandle(d));
      if (classDecl) {
        const chunks = extractor.extract(classDecl, code, 'test.ts');
        const classChunk = chunks.find((c) => c.type === 'class');
        expect(classChunk).toBeDefined();
      }
    });

    it('should extract class with properties', () => {
      const code = `class Test {
  public name: string = 'test';
  private count: number = 0;
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => extractor.canHandle(d));
      if (classDecl) {
        const chunks = extractor.extract(classDecl, code, 'test.ts');
        expect(chunks.length).toBeGreaterThan(0);
      }
    });

    it('should extract class with decorators', () => {
      const code = `@Component({ selector: 'app' })
class AppComponent { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => extractor.canHandle(d));
      if (classDecl) {
        const chunks = extractor.extract(classDecl, code, 'test.ts');
        const classChunk = chunks.find((c) => c.type === 'class');
        expect(classChunk?.decorators.length).toBeGreaterThan(0);
      }
    });

    it('should extract class with type parameters', () => {
      const code = `class Container<T> {
  value: T;
  setValue(value: T) { this.value = value; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => extractor.canHandle(d));
      if (classDecl) {
        const chunks = extractor.extract(classDecl, code, 'test.ts');
        const classChunk = chunks.find((c) => c.type === 'class');
        expect(classChunk?.typeParameters).toContain('T');
      }
    });

    it('should extract exported class', () => {
      const code = `export class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => extractor.canHandle(d));
      if (classDecl) {
        const chunks = extractor.extract(classDecl, code, 'test.ts');
        const classChunk = chunks.find((c) => c.type === 'class');
        expect(classChunk?.exported).toBe(true);
        expect(classChunk?.exportName).toBe('Test');
      }
    });
  });

  describe('getChunkType', () => {
    it('should return class type', () => {
      expect(extractor.getChunkType()).toBe('class');
    });
  });
});
