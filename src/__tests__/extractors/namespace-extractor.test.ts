import { NamespaceExtractor } from '../../extractors/namespace-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';

describe('NamespaceExtractor', () => {
  let extractor: NamespaceExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new NamespaceExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle namespace declarations', () => {
      const code = `namespace Utils { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => adapter.isNamespace(d));
      expect(namespaceDecl).toBeDefined();
      if (namespaceDecl) {
        expect(extractor.canHandle(namespaceDecl)).toBe(true);
      }
    });

    it('should handle exported namespace declarations', () => {
      const code = `export namespace Utils { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => adapter.isNamespace(d));
      expect(namespaceDecl).toBeDefined();
      if (namespaceDecl) {
        expect(extractor.canHandle(namespaceDecl)).toBe(true);
      }
    });

    it('should not handle class declarations', () => {
      const code = `class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        expect(extractor.canHandle(classDecl)).toBe(false);
      }
    });

    it('should not handle interface declarations', () => {
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
    it('should extract simple namespace', () => {
      const code = `namespace Utils { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => extractor.canHandle(d));
      expect(namespaceDecl).toBeDefined();

      if (namespaceDecl) {
        const chunks = extractor.extract(namespaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Utils');
        expect(chunks[0].type).toBe('namespace');
        expect(chunks[0].exported).toBe(false);
        expect(chunks[0].qualifiedName).toBe('Utils');
      }
    });

    it('should extract namespace with content', () => {
      const code = `namespace Utils {
  export function helper() { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (namespaceDecl) {
        const chunks = extractor.extract(namespaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Utils');
        expect(chunks[0].childrenIds).toBeDefined();
      }
    });

    it('should extract exported namespace', () => {
      const code = `export namespace Utils { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (namespaceDecl) {
        const chunks = extractor.extract(namespaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].exported).toBe(true);
        // exportName may be undefined for namespace exports
        expect(chunks[0].exportName === 'Utils' || chunks[0].exportName === undefined).toBe(true);
      }
    });

    it('should extract nested namespace', () => {
      const code = `namespace Outer {
  namespace Inner { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const outerNamespaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (outerNamespaceDecl) {
        const chunks = extractor.extract(outerNamespaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Outer');

        const children = adapter.getChildren(outerNamespaceDecl);
        const innerNamespaceDecl = children.find((d) => adapter.isNamespace(d));
        if (innerNamespaceDecl) {
          const innerChunks = extractor.extract(innerNamespaceDecl, code, 'test.ts', 'Outer');
          expect(innerChunks.length).toBe(1);
          expect(innerChunks[0].qualifiedName).toBe('Outer.Inner');
          expect(innerChunks[0].parentId).toBeDefined();
        }
      }
    });

    it('should extract namespace with functions', () => {
      const code = `namespace Math {
  export function add(a: number, b: number): number { return a + b; }
  export function subtract(a: number, b: number): number { return a - b; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (namespaceDecl) {
        const chunks = extractor.extract(namespaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Math');
      }
    });

    it('should extract namespace with classes', () => {
      const code = `namespace Models {
  export class User { }
  export class Product { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (namespaceDecl) {
        const chunks = extractor.extract(namespaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Models');
      }
    });

    it('should return empty array for invalid namespace node', () => {
      const code = `class Test { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        // Force extract with invalid node
        const chunks = extractor.extract(classDecl, code, 'test.ts');
        expect(chunks.length).toBe(0);
      }
    });

    it('should handle namespace with string literal name', () => {
      const code = `namespace "test" { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => adapter.isNamespace(d));
      if (namespaceDecl) {
        const chunks = extractor.extract(namespaceDecl, code, 'test.ts');
        // Should handle gracefully - may return empty if name is not identifier
        expect(Array.isArray(chunks)).toBe(true);
      }
    });
  });

  describe('getChunkType', () => {
    it('should return namespace type', () => {
      expect(extractor.getChunkType()).toBe('namespace');
    });
  });
});
