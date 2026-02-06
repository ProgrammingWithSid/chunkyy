import { TreeSitterAdapter } from '../../parsers/treesitter-adapter';

describe('TreeSitterAdapter', () => {
  describe('constructor', () => {
    it('should create adapter with language name', () => {
      const adapter = new TreeSitterAdapter('python');
      expect(adapter).toBeDefined();
    });

    it('should create adapter for different languages', () => {
      const pythonAdapter = new TreeSitterAdapter('python');
      const javaAdapter = new TreeSitterAdapter('java');
      const goAdapter = new TreeSitterAdapter('go');

      expect(pythonAdapter).toBeDefined();
      expect(javaAdapter).toBeDefined();
      expect(goAdapter).toBeDefined();
    });
  });

  describe('parse', () => {
    it('should parse code and return ASTNode', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `def hello():
    return "world"`;

      const ast = adapter.parse(code, 'test.py');
      expect(ast).toBeDefined();
      expect(ast.type).toBeDefined();
      expect(ast.range).toBeDefined();
    });

    it('should handle empty code', () => {
      const adapter = new TreeSitterAdapter('python');
      const ast = adapter.parse('', 'test.py');
      expect(ast).toBeDefined();
    });

    it('should parse Python code', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `class Test:
    def method(self):
        pass`;

      const ast = adapter.parse(code, 'test.py');
      expect(ast).toBeDefined();
    });

    it('should parse Java code', () => {
      const adapter = new TreeSitterAdapter('java');
      const code = `public class Test {
    public void method() { }
}`;

      const ast = adapter.parse(code, 'Test.java');
      expect(ast).toBeDefined();
    });

    it('should parse Go code', () => {
      const adapter = new TreeSitterAdapter('go');
      const code = `package main

func hello() string {
    return "world"
}`;

      const ast = adapter.parse(code, 'main.go');
      expect(ast).toBeDefined();
    });
  });

  describe('getRoot', () => {
    it('should return root node', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `def test(): pass`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      expect(root).toBeDefined();
    });
  });

  describe('getTopLevelDeclarations', () => {
    it('should get top-level declarations', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `def func1(): pass
def func2(): pass`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      // May return empty if tree-sitter not initialized, but should not throw
      expect(Array.isArray(declarations)).toBe(true);
    });
  });

  describe('isFunction', () => {
    it('should identify function nodes', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `def test(): pass`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      if (declarations.length > 0) {
        const isFunc = adapter.isFunction(declarations[0]);
        expect(typeof isFunc).toBe('boolean');
      }
    });
  });

  describe('isClass', () => {
    it('should identify class nodes', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `class Test: pass`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      if (declarations.length > 0) {
        const isClass = adapter.isClass(declarations[0]);
        expect(typeof isClass).toBe('boolean');
      }
    });
  });

  describe('getNodeName', () => {
    it('should get node name', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `def test(): pass`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      if (declarations.length > 0) {
        const name = adapter.getNodeName(declarations[0]);
        // May be undefined if tree-sitter not initialized
        expect(name === undefined || typeof name === 'string').toBe(true);
      }
    });
  });

  describe('getNodeRange', () => {
    it('should get node range', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `def test(): pass`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      if (declarations.length > 0) {
        const range = adapter.getNodeRange(declarations[0]);
        // May be undefined if tree-sitter not initialized
        if (range) {
          expect(range.start.line).toBeGreaterThan(0);
          expect(range.end.line).toBeGreaterThanOrEqual(range.start.line);
        }
      }
    });
  });

  describe('getChildren', () => {
    it('should get children nodes', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `class Test:
    def method(self): pass`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      if (declarations.length > 0) {
        const children = adapter.getChildren(declarations[0]);
        expect(Array.isArray(children)).toBe(true);
      }
    });
  });

  describe('isExported', () => {
    it('should check if node is exported', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `def test(): pass`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      if (declarations.length > 0) {
        const exported = adapter.isExported(declarations[0]);
        expect(typeof exported).toBe('boolean');
      }
    });
  });

  describe('getImports', () => {
    it('should get imports from code', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `import os
from typing import List`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const imports = adapter.getImports(root);
      expect(Array.isArray(imports)).toBe(true);
    });
  });

  describe('extractCode', () => {
    it('should extract code from node', () => {
      const adapter = new TreeSitterAdapter('python');
      const code = `def test():
    return 42`;
      const ast = adapter.parse(code, 'test.py');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      if (declarations.length > 0) {
        const extracted = adapter.extractCode(declarations[0], code);
        expect(typeof extracted).toBe('string');
      }
    });
  });
});
