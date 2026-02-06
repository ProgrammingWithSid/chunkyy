import { EnumExtractor } from '../../extractors/enum-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';

describe('EnumExtractor', () => {
  let extractor: EnumExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new EnumExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle enum declarations', () => {
      const code = `enum Status { Active, Inactive }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => adapter.isEnum(d));
      expect(enumDecl).toBeDefined();
      if (enumDecl) {
        expect(extractor.canHandle(enumDecl)).toBe(true);
      }
    });

    it('should handle exported enum declarations', () => {
      const code = `export enum Status { Active, Inactive }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => adapter.isEnum(d));
      expect(enumDecl).toBeDefined();
      if (enumDecl) {
        expect(extractor.canHandle(enumDecl)).toBe(true);
      }
    });

    it('should handle const enum declarations', () => {
      const code = `const enum Status { Active, Inactive }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => adapter.isEnum(d));
      expect(enumDecl).toBeDefined();
      if (enumDecl) {
        expect(extractor.canHandle(enumDecl)).toBe(true);
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
    it('should extract simple enum', () => {
      const code = `enum Status { Active, Inactive }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => extractor.canHandle(d));
      expect(enumDecl).toBeDefined();

      if (enumDecl) {
        const chunks = extractor.extract(enumDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Status');
        expect(chunks[0].type).toBe('enum');
        expect(chunks[0].exported).toBe(false);
        expect(chunks[0].qualifiedName).toBe('Status');
      }
    });

    it('should extract enum with string values', () => {
      const code = `enum Color { Red = "red", Green = "green", Blue = "blue" }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => extractor.canHandle(d));
      if (enumDecl) {
        const chunks = extractor.extract(enumDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Color');
        expect(chunks[0].type).toBe('enum');
      }
    });

    it('should extract enum with numeric values', () => {
      const code = `enum Direction { Up = 1, Down = 2, Left = 3, Right = 4 }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => extractor.canHandle(d));
      if (enumDecl) {
        const chunks = extractor.extract(enumDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Direction');
      }
    });

    it('should extract exported enum', () => {
      const code = `export enum Status { Active, Inactive }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => extractor.canHandle(d));
      if (enumDecl) {
        const chunks = extractor.extract(enumDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].exported).toBe(true);
        expect(chunks[0].exportName).toBe('Status');
      }
    });

    it('should extract const enum', () => {
      const code = `const enum Status { Active, Inactive }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => extractor.canHandle(d));
      if (enumDecl) {
        const chunks = extractor.extract(enumDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Status');
      }
    });

    it('should extract enum with computed values', () => {
      const code = `enum Test { A = 1, B = A * 2 }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => extractor.canHandle(d));
      if (enumDecl) {
        const chunks = extractor.extract(enumDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Test');
      }
    });

    it('should extract enum with JSDoc', () => {
      const code = `/**
 * Status enumeration
 */
enum Status { Active, Inactive }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => extractor.canHandle(d));
      if (enumDecl) {
        const chunks = extractor.extract(enumDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].jsdoc).toBeDefined();
      }
    });

    it('should return empty array for enum without name', () => {
      // This shouldn't happen in valid TypeScript, but test edge case
      const code = `enum { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const enumDecl = declarations.find((d) => adapter.isEnum(d));
      if (enumDecl) {
        const chunks = extractor.extract(enumDecl, code, 'test.ts');
        expect(chunks.length).toBe(0);
      }
    });

    it('should handle nested enum in namespace', () => {
      const code = `namespace Utils {
  export enum Status { Active, Inactive }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => adapter.isNamespace(d));
      if (namespaceDecl) {
        const children = adapter.getChildren(namespaceDecl);
        const enumDecl = children.find((d) => adapter.isEnum(d));
        if (enumDecl) {
          const chunks = extractor.extract(enumDecl, code, 'test.ts', 'Utils');
          expect(chunks.length).toBe(1);
          expect(chunks[0].qualifiedName).toBe('Utils.Status');
          expect(chunks[0].parentId).toBeDefined();
        }
      }
    });
  });

  describe('getChunkType', () => {
    it('should return enum type', () => {
      expect(extractor.getChunkType()).toBe('enum');
    });
  });
});
