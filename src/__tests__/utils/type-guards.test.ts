import * as ts from 'typescript';
import {
  hasTypeScriptNode,
  getTypeScriptNode,
  isTypeScriptSourceFile,
  getTypeScriptSourceFile,
  createASTNodeFromTS,
} from '../../utils/type-guards';
import { ASTNode } from '../../types';

describe('type-guards', () => {
  describe('hasTypeScriptNode', () => {
    it('should return true for ASTNode with TypeScript node', () => {
      const code = `function test() { }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const funcDecl = sourceFile.statements[0] as ts.FunctionDeclaration;
      const astNode = createASTNodeFromTS(funcDecl);

      expect(hasTypeScriptNode(astNode)).toBe(true);
    });

    it('should return false for ASTNode without TypeScript node', () => {
      const astNode: ASTNode = {
        type: 'test',
        range: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
        },
        language: 'typescript',
      };

      expect(hasTypeScriptNode(astNode)).toBe(false);
    });
  });

  describe('getTypeScriptNode', () => {
    it('should extract TypeScript node from ASTNode', () => {
      const code = `function test() { }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const funcDecl = sourceFile.statements[0] as ts.FunctionDeclaration;
      const astNode = createASTNodeFromTS(funcDecl);

      const tsNode = getTypeScriptNode(astNode);
      expect(tsNode).toBeDefined();
      expect(ts.isFunctionDeclaration(tsNode!)).toBe(true);
    });

    it('should return null for ASTNode without TypeScript node', () => {
      const astNode: ASTNode = {
        type: 'test',
        range: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
        },
        language: 'typescript',
      };

      expect(getTypeScriptNode(astNode)).toBeNull();
    });
  });

  describe('isTypeScriptSourceFile', () => {
    it('should return true for SourceFile ASTNode', () => {
      const code = `function test() { }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const astNode = createASTNodeFromTS(sourceFile);

      expect(isTypeScriptSourceFile(astNode)).toBe(true);
    });

    it('should return false for non-SourceFile ASTNode', () => {
      const code = `function test() { }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const funcDecl = sourceFile.statements[0] as ts.FunctionDeclaration;
      const astNode = createASTNodeFromTS(funcDecl);

      expect(isTypeScriptSourceFile(astNode)).toBe(false);
    });
  });

  describe('getTypeScriptSourceFile', () => {
    it('should extract SourceFile from ASTNode', () => {
      const code = `function test() { }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const astNode = createASTNodeFromTS(sourceFile);

      const extracted = getTypeScriptSourceFile(astNode);
      expect(extracted).toBeDefined();
      expect(ts.isSourceFile(extracted!)).toBe(true);
    });

    it('should return null for non-SourceFile ASTNode', () => {
      const code = `function test() { }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const funcDecl = sourceFile.statements[0] as ts.FunctionDeclaration;
      const astNode = createASTNodeFromTS(funcDecl);

      expect(getTypeScriptSourceFile(astNode)).toBeNull();
    });
  });

  describe('createASTNodeFromTS', () => {
    it('should create ASTNode from TypeScript node', () => {
      const code = `function test() { return 1; }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const funcDecl = sourceFile.statements[0] as ts.FunctionDeclaration;

      const astNode = createASTNodeFromTS(funcDecl);
      expect(astNode).toBeDefined();
      expect(astNode.type).toBeDefined();
      expect(astNode.range).toBeDefined();
      if (astNode.range) {
        expect(astNode.range.start.line).toBeGreaterThan(0);
        expect(astNode.range.end.line).toBeGreaterThanOrEqual(astNode.range.start.line);
      }
      expect(astNode.language).toBe('typescript');
    });

    it('should create ASTNode with custom range', () => {
      const code = `function test() { return 1; }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const funcDecl = sourceFile.statements[0] as ts.FunctionDeclaration;

      const customRange = {
        start: { line: 10, column: 5 },
        end: { line: 15, column: 10 },
      };

      const astNode = createASTNodeFromTS(funcDecl, customRange);
      expect(astNode.range).toBeDefined();
      if (astNode.range) {
        expect(astNode.range.start.line).toBe(10);
        expect(astNode.range.start.column).toBe(5);
        expect(astNode.range.end.line).toBe(15);
        expect(astNode.range.end.column).toBe(10);
      }
    });

    it('should store TypeScript node in ASTNode', () => {
      const code = `function test() { return 1; }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const funcDecl = sourceFile.statements[0] as ts.FunctionDeclaration;

      const astNode = createASTNodeFromTS(funcDecl);
      const tsNode = getTypeScriptNode(astNode);
      expect(tsNode).toBe(funcDecl);
    });

    it('should handle different TypeScript node types', () => {
      const code = `class Test { }
interface ITest { }
enum Status { Active }`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const classDecl = sourceFile.statements[0] as ts.ClassDeclaration;
      const interfaceDecl = sourceFile.statements[1] as ts.InterfaceDeclaration;
      const enumDecl = sourceFile.statements[2] as ts.EnumDeclaration;

      const classNode = createASTNodeFromTS(classDecl);
      const interfaceNode = createASTNodeFromTS(interfaceDecl);
      const enumNode = createASTNodeFromTS(enumDecl);

      expect(classNode).toBeDefined();
      expect(interfaceNode).toBeDefined();
      expect(enumNode).toBeDefined();

      expect(getTypeScriptNode(classNode)).toBe(classDecl);
      expect(getTypeScriptNode(interfaceNode)).toBe(interfaceDecl);
      expect(getTypeScriptNode(enumNode)).toBe(enumDecl);
    });
  });
});
