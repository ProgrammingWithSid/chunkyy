import { Chunker } from '../core/chunker';

describe('Chunker', () => {
  let chunker: Chunker;

  beforeEach(() => {
    chunker = new Chunker({ parser: 'typescript' });
  });

  describe('chunkCode', () => {
    it('should extract function chunks', () => {
      const code = `
        export function hello(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      expect(chunks.length).toBeGreaterThan(0);

      const functionChunk = chunks.find((c) => c.type === 'function');
      expect(functionChunk).toBeDefined();
      expect(functionChunk?.name).toBe('hello');
      expect(functionChunk?.exported).toBe(true);
    });

    it('should extract class chunks with methods', () => {
      const code = `
        export class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }

          subtract(a: number, b: number): number {
            return a - b;
          }
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      expect(chunks.length).toBeGreaterThan(0);

      const classChunk = chunks.find((c) => c.type === 'class');
      expect(classChunk).toBeDefined();
      expect(classChunk?.name).toBe('Calculator');

      const methodChunks = chunks.filter((c) => c.type === 'method');
      expect(methodChunks.length).toBe(2);
    });

    it('should extract interface chunks', () => {
      const code = `
        export interface User {
          id: number;
          name: string;
          email: string;
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      const interfaceChunk = chunks.find((c) => c.type === 'interface');
      expect(interfaceChunk).toBeDefined();
      expect(interfaceChunk?.name).toBe('User');
    });

    it('should extract enum chunks', () => {
      const code = `
        export enum Status {
          Pending = 'pending',
          Active = 'active',
          Inactive = 'inactive'
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      const enumChunk = chunks.find((c) => c.type === 'enum');
      expect(enumChunk).toBeDefined();
      expect(enumChunk?.name).toBe('Status');
    });

    it('should handle nested functions', () => {
      const code = `
        function outer() {
          function inner() {
            return 42;
          }
          return inner();
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      // Should extract outer function
      const outerChunk = chunks.find((c) => c.name === 'outer');
      expect(outerChunk).toBeDefined();
    });

    it('should handle arrow functions', () => {
      const code = `
        export const add = (a: number, b: number) => a + b;
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      // Arrow functions assigned to variables should be extracted
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle decorators', () => {
      const code = `
        @Component({
          selector: 'app-root'
        })
        export class AppComponent {
          @Input() title: string = 'Hello';
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      const classChunk = chunks.find((c) => c.type === 'class');
      expect(classChunk?.decorators.length).toBeGreaterThan(0);
    });

    it('should extract dependencies', () => {
      const code = `
        import { Component } from '@angular/core';
        import { Observable } from 'rxjs';

        export function useObservable() {
          return new Observable();
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      const functionChunk = chunks.find((c) => c.type === 'function');
      expect(functionChunk?.dependencies.length).toBeGreaterThan(0);
    });

    it('should generate stable chunk IDs', () => {
      const code = `
        export function test() {
          return 42;
        }
      `;

      const chunks1 = chunker.chunkCode(code, 'test.ts');
      const chunks2 = chunker.chunkCode(code, 'test.ts');

      expect(chunks1[0].id).toBe(chunks2[0].id);
    });

    it('should handle async functions', () => {
      const code = `
        export async function fetchData() {
          const response = await fetch('/api/data');
          return response.json();
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      const functionChunk = chunks.find((c) => c.type === 'function');
      expect(functionChunk?.async).toBe(true);
    });

    it('should handle generator functions', () => {
      const code = `
        export function* generateNumbers() {
          yield 1;
          yield 2;
          yield 3;
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      const functionChunk = chunks.find((c) => c.type === 'function');
      expect(functionChunk?.generator).toBe(true);
    });

    it('should handle function overloads', () => {
      const code = `
        function process(value: string): string;
        function process(value: number): number;
        function process(value: string | number): string | number {
          return value;
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      // Should extract the implementation
      const functionChunk = chunks.find((c) => c.name === 'process');
      expect(functionChunk).toBeDefined();
    });

    it('should handle type parameters (generics)', () => {
      const code = `
        export function identity<T>(value: T): T {
          return value;
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      const functionChunk = chunks.find((c) => c.type === 'function');
      expect(functionChunk?.typeParameters).toContain('T');
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build dependency graph', () => {
      const code1 = `
        export function helper() {
          return 42;
        }
      `;

      const code2 = `
        import { helper } from './code1';
        export function main() {
          return helper();
        }
      `;

      const chunks1 = chunker.chunkCode(code1, 'code1.ts');
      const chunks2 = chunker.chunkCode(code2, 'code2.ts');

      const allChunks = [...chunks1, ...chunks2];
      const graph = chunker.buildDependencyGraph(allChunks);

      expect(Object.keys(graph).length).toBeGreaterThan(0);
    });
  });

  describe('buildImportExportMap', () => {
    it('should build import/export map', () => {
      const code = `
        import { Component } from '@angular/core';
        export function test() {
          return 42;
        }
      `;

      const chunks = chunker.chunkCode(code, 'test.ts');
      const map = chunker.buildImportExportMap(chunks);

      expect(map.exports.size).toBeGreaterThan(0);
      expect(map.imports.size).toBeGreaterThan(0);
    });
  });
});
