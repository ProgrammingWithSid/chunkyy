import { TypeAliasExtractor } from '../../extractors/type-alias-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';

describe('TypeAliasExtractor', () => {
  let extractor: TypeAliasExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new TypeAliasExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle type alias declarations', () => {
      const code = `type User = { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => adapter.isTypeAlias(d));
      expect(typeAliasDecl).toBeDefined();
      if (typeAliasDecl) {
        expect(extractor.canHandle(typeAliasDecl)).toBe(true);
      }
    });

    it('should handle exported type alias declarations', () => {
      const code = `export type User = { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => adapter.isTypeAlias(d));
      expect(typeAliasDecl).toBeDefined();
      if (typeAliasDecl) {
        expect(extractor.canHandle(typeAliasDecl)).toBe(true);
      }
    });

    it('should not handle interface declarations', () => {
      const code = `interface User { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      if (interfaceDecl) {
        expect(extractor.canHandle(interfaceDecl)).toBe(false);
      }
    });

    it('should not handle class declarations', () => {
      const code = `class User { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        expect(extractor.canHandle(classDecl)).toBe(false);
      }
    });
  });

  describe('extract', () => {
    it('should extract simple type alias', () => {
      const code = `type User = { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      expect(typeAliasDecl).toBeDefined();

      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('User');
        expect(chunks[0].type).toBe('type-alias');
        expect(chunks[0].exported).toBe(false);
        expect(chunks[0].qualifiedName).toBe('User');
      }
    });

    it('should extract type alias with union type', () => {
      const code = `type Status = 'active' | 'inactive' | 'pending'`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Status');
      }
    });

    it('should extract type alias with intersection type', () => {
      const code = `type Combined = TypeA & TypeB`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Combined');
      }
    });

    it('should extract exported type alias', () => {
      const code = `export type User = { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].exported).toBe(true);
        expect(chunks[0].exportName).toBe('User');
      }
    });

    it('should extract type alias with type parameters', () => {
      const code = `type Container<T> = { value: T; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].typeParameters).toContain('T');
      }
    });

    it('should extract type alias with multiple type parameters', () => {
      const code = `type Pair<T, U> = { first: T; second: U; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].typeParameters).toContain('T');
        expect(chunks[0].typeParameters).toContain('U');
      }
    });

    it('should extract type alias with function type', () => {
      const code = `type Handler = (event: string) => void`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Handler');
      }
    });

    it('should extract type alias with mapped type', () => {
      const code = `type Readonly<T> = { readonly [P in keyof T]: T[P]; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].typeParameters).toContain('T');
      }
    });

    it('should extract type alias with conditional type', () => {
      const code = `type NonNullable<T> = T extends null | undefined ? never : T`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => extractor.canHandle(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('NonNullable');
      }
    });

    it('should return empty array for type alias without name', () => {
      // This shouldn't happen in valid TypeScript, but test edge case
      const code = `type = string`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => adapter.isTypeAlias(d));
      if (typeAliasDecl) {
        const chunks = extractor.extract(typeAliasDecl, code, 'test.ts');
        expect(chunks.length).toBe(0);
      }
    });

    it('should handle nested type alias in namespace', () => {
      const code = `namespace Utils {
  export type User = { name: string; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => adapter.isNamespace(d));
      if (namespaceDecl) {
        const children = adapter.getChildren(namespaceDecl);
        const typeAliasDecl = children.find((d) => adapter.isTypeAlias(d));
        if (typeAliasDecl) {
          const chunks = extractor.extract(typeAliasDecl, code, 'test.ts', 'Utils');
          expect(chunks.length).toBe(1);
          expect(chunks[0].qualifiedName).toBe('Utils.User');
          expect(chunks[0].parentId).toBeDefined();
        }
      }
    });
  });

  describe('getChunkType', () => {
    it('should return type-alias type', () => {
      expect(extractor.getChunkType()).toBe('type-alias');
    });
  });
});
