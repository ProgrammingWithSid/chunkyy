import { InterfaceExtractor } from '../../extractors/interface-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';

describe('InterfaceExtractor', () => {
  let extractor: InterfaceExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new InterfaceExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle interface declarations', () => {
      const code = `interface User { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      expect(interfaceDecl).toBeDefined();
      if (interfaceDecl) {
        expect(extractor.canHandle(interfaceDecl)).toBe(true);
      }
    });

    it('should handle exported interface declarations', () => {
      const code = `export interface User { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      expect(interfaceDecl).toBeDefined();
      if (interfaceDecl) {
        expect(extractor.canHandle(interfaceDecl)).toBe(true);
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

    it('should not handle type alias declarations', () => {
      const code = `type User = { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const typeAliasDecl = declarations.find((d) => adapter.isTypeAlias(d));
      if (typeAliasDecl) {
        expect(extractor.canHandle(typeAliasDecl)).toBe(false);
      }
    });
  });

  describe('extract', () => {
    it('should extract simple interface', () => {
      const code = `interface User { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      expect(interfaceDecl).toBeDefined();

      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('User');
        expect(chunks[0].type).toBe('interface');
        expect(chunks[0].exported).toBe(false);
        expect(chunks[0].qualifiedName).toBe('User');
      }
    });

    it('should extract interface with properties', () => {
      const code = `interface User {
  id: number;
  name: string;
  email: string;
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('User');
      }
    });

    it('should extract interface with methods', () => {
      const code = `interface User {
  getName(): string;
  setName(name: string): void;
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('User');
      }
    });

    it('should extract interface with optional properties', () => {
      const code = `interface User {
  name: string;
  email?: string;
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('User');
      }
    });

    it('should extract interface with readonly properties', () => {
      const code = `interface User {
  readonly id: number;
  name: string;
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('User');
      }
    });

    it('should extract exported interface', () => {
      const code = `export interface User { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].exported).toBe(true);
        expect(chunks[0].exportName).toBe('User');
      }
    });

    it('should extract interface with type parameters', () => {
      const code = `interface Container<T> {
  value: T;
  setValue(value: T): void;
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].typeParameters).toContain('T');
      }
    });

    it('should extract interface extending another interface', () => {
      const code = `interface Base { id: number; }
interface User extends Base { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find(
        (d) => extractor.canHandle(d) && adapter.getNodeName(d) === 'User'
      );
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('User');
      }
    });

    it('should extract interface with index signatures', () => {
      const code = `interface Dictionary {
  [key: string]: string;
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].name).toBe('Dictionary');
      }
    });

    it('should extract interface with JSDoc', () => {
      const code = `/**
 * User interface
 * @property name - User's name
 */
interface User { name: string; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => extractor.canHandle(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(1);
        expect(chunks[0].jsdoc).toBeDefined();
      }
    });

    it('should return empty array for interface without name', () => {
      // This shouldn't happen in valid TypeScript, but test edge case
      const code = `interface { }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const interfaceDecl = declarations.find((d) => adapter.isInterface(d));
      if (interfaceDecl) {
        const chunks = extractor.extract(interfaceDecl, code, 'test.ts');
        expect(chunks.length).toBe(0);
      }
    });

    it('should handle nested interface in namespace', () => {
      const code = `namespace Utils {
  export interface User { name: string; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const namespaceDecl = declarations.find((d) => adapter.isNamespace(d));
      if (namespaceDecl) {
        const children = adapter.getChildren(namespaceDecl);
        const interfaceDecl = children.find((d) => adapter.isInterface(d));
        if (interfaceDecl) {
          const chunks = extractor.extract(interfaceDecl, code, 'test.ts', 'Utils');
          expect(chunks.length).toBe(1);
          expect(chunks[0].qualifiedName).toBe('Utils.User');
          expect(chunks[0].parentId).toBeDefined();
        }
      }
    });
  });

  describe('getChunkType', () => {
    it('should return interface type', () => {
      expect(extractor.getChunkType()).toBe('interface');
    });
  });
});
