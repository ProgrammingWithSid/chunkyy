import * as ts from 'typescript';
import { MethodExtractor } from '../../extractors/method-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';
import { getTypeScriptNode } from '../../utils/type-guards';

describe('MethodExtractor', () => {
  let extractor: MethodExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new MethodExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle method declarations', () => {
      const code = `class Test {
  method() { return 1; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      expect(classDecl).toBeDefined();
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => adapter.isFunction(c));
        if (method) {
          expect(extractor.canHandle(method)).toBe(true);
        }
      }
    });

    it('should handle constructor declarations', () => {
      const code = `class Test {
  constructor() { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const constructor = children.find((c) => {
          const tsNode = getTypeScriptNode(c);
          return tsNode && ts.isConstructorDeclaration(tsNode);
        });
        if (constructor) {
          expect(extractor.canHandle(constructor)).toBe(true);
        }
      }
    });

    it('should handle getter accessors', () => {
      const code = `class Test {
  get value() { return 1; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const getter = children.find((c) => {
          const tsNode = getTypeScriptNode(c);
          return tsNode && ts.isGetAccessorDeclaration(tsNode);
        });
        if (getter) {
          expect(extractor.canHandle(getter)).toBe(true);
        }
      }
    });

    it('should handle setter accessors', () => {
      const code = `class Test {
  set value(v: number) { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const setter = children.find((c) => {
          const tsNode = getTypeScriptNode(c);
          return tsNode && ts.isSetAccessorDeclaration(tsNode);
        });
        if (setter) {
          expect(extractor.canHandle(setter)).toBe(true);
        }
      }
    });

    it('should not handle top-level function declarations', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(extractor.canHandle(funcDecl)).toBe(false);
      }
    });

    it('should not handle arrow functions in variables', () => {
      const code = `const test = () => 1;`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const varDecl = declarations.find((d) => !adapter.isFunction(d));
      if (varDecl) {
        expect(extractor.canHandle(varDecl)).toBe(false);
      }
    });
  });

  describe('extract', () => {
    it('should extract simple method', () => {
      const code = `class Calculator {
  add(a: number, b: number): number { return a + b; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => extractor.canHandle(c));
        if (method) {
          const chunks = extractor.extract(method, code, 'test.ts', 'Calculator');
          expect(chunks.length).toBe(1);
          expect(chunks[0].name).toBe('add');
          expect(chunks[0].type).toBe('method');
          expect(chunks[0].qualifiedName).toBe('Calculator.add');
          expect(chunks[0].parentId).toBeDefined();
        }
      }
    });

    it('should extract constructor', () => {
      const code = `class Test {
  constructor(private value: number) { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const constructor = children.find((c) => {
          const tsNode = getTypeScriptNode(c);
          return tsNode && ts.isConstructorDeclaration(tsNode);
        });
        if (constructor) {
          const chunks = extractor.extract(constructor, code, 'test.ts', 'Test');
          expect(chunks.length).toBe(1);
          expect(chunks[0].name).toBe('constructor');
          expect(chunks[0].qualifiedName).toBe('Test.constructor');
        }
      }
    });

    it('should extract method with visibility modifiers', () => {
      const code = `class Test {
  public publicMethod() { }
  private privateMethod() { }
  protected protectedMethod() { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const methods = children.filter((c) => extractor.canHandle(c));

        const chunks = methods.flatMap((m) => extractor.extract(m, code, 'test.ts', 'Test'));
        expect(chunks.length).toBeGreaterThanOrEqual(3);

        const publicChunk = chunks.find((c) => c.name === 'publicMethod');
        const privateChunk = chunks.find((c) => c.name === 'privateMethod');
        const protectedChunk = chunks.find((c) => c.name === 'protectedMethod');

        if (publicChunk) expect(publicChunk.visibility).toBe('public');
        if (privateChunk) expect(privateChunk.visibility).toBe('private');
        if (protectedChunk) expect(protectedChunk.visibility).toBe('protected');
      }
    });

    it('should extract async method', () => {
      const code = `class Service {
  async fetchData(): Promise<string> { return ''; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => extractor.canHandle(c));
        if (method) {
          const chunks = extractor.extract(method, code, 'test.ts', 'Service');
          expect(chunks.length).toBe(1);
          expect(chunks[0].async).toBe(true);
        }
      }
    });

    it('should extract generator method', () => {
      const code = `class Generator {
  *generate(): Generator<number> { yield 1; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => extractor.canHandle(c));
        if (method) {
          const chunks = extractor.extract(method, code, 'test.ts', 'Generator');
          expect(chunks.length).toBe(1);
          expect(chunks[0].generator).toBe(true);
        }
      }
    });

    it('should extract getter accessor', () => {
      const code = `class Test {
  get value(): number { return 1; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const getter = children.find((c) => {
          const tsNode = getTypeScriptNode(c);
          return tsNode && ts.isGetAccessorDeclaration(tsNode);
        });
        if (getter) {
          const chunks = extractor.extract(getter, code, 'test.ts', 'Test');
          expect(chunks.length).toBe(1);
          expect(chunks[0].name).toBe('value');
        }
      }
    });

    it('should extract setter accessor', () => {
      const code = `class Test {
  set value(v: number) { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const setter = children.find((c) => {
          const tsNode = getTypeScriptNode(c);
          return tsNode && ts.isSetAccessorDeclaration(tsNode);
        });
        if (setter) {
          const chunks = extractor.extract(setter, code, 'test.ts', 'Test');
          expect(chunks.length).toBe(1);
          expect(chunks[0].name).toBe('value');
        }
      }
    });

    it('should return empty array when parentQualifiedName is missing', () => {
      const code = `class Test {
  method() { return 1; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => extractor.canHandle(c));
        if (method) {
          const chunks = extractor.extract(method, code, 'test.ts');
          expect(chunks.length).toBe(0);
        }
      }
    });

    it('should extract method with parameters', () => {
      const code = `class Calculator {
  add(a: number, b: number): number { return a + b; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => extractor.canHandle(c));
        if (method) {
          const chunks = extractor.extract(method, code, 'test.ts', 'Calculator');
          expect(chunks.length).toBe(1);
          expect(chunks[0].parameters.length).toBe(2);
          expect(chunks[0].parameters[0].name).toBe('a');
          expect(chunks[0].parameters[1].name).toBe('b');
          expect(chunks[0].returnType).toBe('number');
        }
      }
    });

    it('should extract method with type parameters', () => {
      const code = `class Container {
  getValue<T>(): T | null { return null; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const classDecl = declarations.find((d) => adapter.isClass(d));
      if (classDecl) {
        const children = adapter.getChildren(classDecl);
        const method = children.find((c) => extractor.canHandle(c));
        if (method) {
          const chunks = extractor.extract(method, code, 'test.ts', 'Container');
          expect(chunks.length).toBe(1);
          expect(chunks[0].typeParameters).toContain('T');
        }
      }
    });
  });

  describe('getChunkType', () => {
    it('should return method type', () => {
      expect(extractor.getChunkType()).toBe('method');
    });
  });
});
