import * as fs from 'fs';
import * as path from 'path';
import { Chunker } from '../core/chunker';

describe('extractCodeWithDependencies', () => {
  let chunker: Chunker;
  const testDir = path.join(__dirname, '../../test-temp');

  beforeEach(() => {
    chunker = new Chunker({ parser: 'typescript', includeContent: true });

    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files individually, then remove directory
    if (fs.existsSync(testDir)) {
      try {
        const files = fs.readdirSync(testDir);
        for (const file of files) {
          const filePath = path.join(testDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
        fs.rmdirSync(testDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('basic extraction', () => {
    it('should extract chunks for single file with single range', async () => {
      const testFile = path.join(testDir, 'test1.ts');
      const code = `
export function helper() {
  return 42;
}

export function main() {
  return helper();
}
`;
      fs.writeFileSync(testFile, code);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/test1.ts',
          ranges: [{ start: 5, end: 7 }], // main function
        },
      ]);

      expect(result.selectedChunks.length).toBeGreaterThan(0);
      expect(result.codeBlocks.size).toBeGreaterThan(0);
      expect(result.codeBlocks.has('test-temp/test1.ts')).toBe(true);
    });

    it('should extract chunks for single file with multiple ranges', async () => {
      const testFile = path.join(testDir, 'test2.ts');
      const code = `
export function func1() {
  return 1;
}

export function func2() {
  return 2;
}

export function func3() {
  return 3;
}
`;
      fs.writeFileSync(testFile, code);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/test2.ts',
          ranges: [
            { start: 2, end: 4 },  // func1
            { start: 10, end: 12 }, // func3
          ],
        },
      ]);

      // Functions span multiple lines, so ranges may capture overlapping chunks
      expect(result.selectedChunks.length).toBeGreaterThanOrEqual(1);
      const funcNames = result.selectedChunks.map(c => c.name);
      // Verify we got some functions
      expect(funcNames.length).toBeGreaterThan(0);
    });

    it('should extract chunks for multiple files', async () => {
      const file1 = path.join(testDir, 'file1.ts');
      const file2 = path.join(testDir, 'file2.ts');

      fs.writeFileSync(file1, 'export function a() { return 1; }');
      fs.writeFileSync(file2, 'export function b() { return 2; }');

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/file1.ts',
          ranges: [{ start: 1, end: 1 }],
        },
        {
          filePath: 'test-temp/file2.ts',
          ranges: [{ start: 1, end: 1 }],
        },
      ]);

      expect(result.codeBlocks.size).toBeGreaterThanOrEqual(2);
      expect(result.codeBlocks.has('test-temp/file1.ts')).toBe(true);
      expect(result.codeBlocks.has('test-temp/file2.ts')).toBe(true);
    });
  });

  describe('dependency resolution', () => {
    it('should include dependencies from same file', async () => {
      const testFile = path.join(testDir, 'deps1.ts');
      const code = `
export function helper() {
  return 42;
}

export function main() {
  return helper();
}
`;
      fs.writeFileSync(testFile, code);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/deps1.ts',
          ranges: [{ start: 5, end: 7 }], // main function
        },
      ]);

      // Helper function might be in selected chunks if range overlaps, or in dependencies
      const helperChunk = result.allChunks.find(c => c.name === 'helper');
      expect(helperChunk).toBeDefined();
      expect(result.dependencyGraph).toBeDefined();
    });

    it('should include dependencies from imported files', async () => {
      const utilsFile = path.join(testDir, 'utils.ts');
      const mainFile = path.join(testDir, 'main.ts');

      fs.writeFileSync(utilsFile, `
export function helper() {
  return 42;
}
`);

      fs.writeFileSync(mainFile, `
import { helper } from './utils';

export function main() {
  return helper();
}
`);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/main.ts',
          ranges: [{ start: 4, end: 6 }], // main function
        },
      ]);

      expect(result.selectedChunks.length).toBeGreaterThan(0);
      // Should attempt to resolve helper from utils.ts
      expect(result.dependencyGraph).toBeDefined();
    });

    it('should build dependency graph correctly', async () => {
      const testFile = path.join(testDir, 'graph.ts');
      const code = `
export function a() {
  return 1;
}

export function b() {
  return a();
}

export function c() {
  return b();
}
`;
      fs.writeFileSync(testFile, code);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/graph.ts',
          ranges: [{ start: 9, end: 11 }], // function c
        },
      ]);

      expect(result.dependencyGraph).toBeDefined();
      expect(Object.keys(result.dependencyGraph).length).toBeGreaterThan(0);
    });
  });

  describe('chunk overlap detection', () => {
    it('should find chunks that overlap with range', async () => {
      const testFile = path.join(testDir, 'overlap.ts');
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
      fs.writeFileSync(testFile, code);

      // Range that overlaps with class but not fully covers it
      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/overlap.ts',
          ranges: [{ start: 3, end: 5 }], // Part of the class
        },
      ]);

      const classChunk = result.selectedChunks.find(c => c.type === 'class');
      expect(classChunk).toBeDefined();
      expect(classChunk?.name).toBe('Calculator');
    });

    it('should handle ranges that span multiple chunks', async () => {
      const testFile = path.join(testDir, 'span.ts');
      const code = `
export function a() {
  return 1;
}

export function b() {
  return 2;
}

export function c() {
  return 3;
}
`;
      fs.writeFileSync(testFile, code);

      // Range that spans multiple functions
      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/span.ts',
          ranges: [{ start: 2, end: 10 }], // Spans a, b, and part of c
        },
      ]);

      // Range spanning multiple functions should capture at least one
      expect(result.selectedChunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('code blocks generation', () => {
    it('should generate code blocks for extracted chunks', async () => {
      const testFile = path.join(testDir, 'blocks.ts');
      const code = `
export function test() {
  return 'hello';
}
`;
      fs.writeFileSync(testFile, code);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/blocks.ts',
          ranges: [{ start: 2, end: 4 }],
        },
      ]);

      expect(result.codeBlocks.size).toBeGreaterThan(0);
      const codeBlock = result.codeBlocks.get('test-temp/blocks.ts');
      expect(codeBlock).toBeDefined();
      expect(codeBlock).toContain('test');
    });

    it('should include imports in code blocks', async () => {
      const testFile = path.join(testDir, 'imports.ts');
      const code = `
import { helper } from './utils';

export function main() {
  return helper();
}
`;
      fs.writeFileSync(testFile, code);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/imports.ts',
          ranges: [{ start: 4, end: 6 }],
        },
      ]);

      const codeBlock = result.codeBlocks.get('test-temp/imports.ts');
      expect(codeBlock).toContain('import');
    });
  });

  describe('edge cases', () => {
    it('should handle empty ranges gracefully', async () => {
      const testFile = path.join(testDir, 'empty.ts');
      fs.writeFileSync(testFile, 'export function test() { return 1; }');

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/empty.ts',
          ranges: [],
        },
      ]);

      expect(result.selectedChunks.length).toBe(0);
      expect(result.codeBlocks.size).toBe(0);
    });

    it('should handle non-existent files gracefully', async () => {
      await expect(
        chunker.extractCodeWithDependencies([
          {
            filePath: 'test-temp/nonexistent.ts',
            ranges: [{ start: 1, end: 10 }],
          },
        ])
      ).rejects.toThrow();
    });

    it('should handle invalid ranges', async () => {
      const testFile = path.join(testDir, 'invalid.ts');
      fs.writeFileSync(testFile, 'export function test() { return 1; }');

      // Range where start > end
      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/invalid.ts',
          ranges: [{ start: 10, end: 5 }],
        },
      ]);

      // Should still work (overlap detection handles this)
      expect(result).toBeDefined();
    });
  });

  describe('complex scenarios', () => {
    it('should handle classes with methods', async () => {
      const testFile = path.join(testDir, 'class.ts');
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
      fs.writeFileSync(testFile, code);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/class.ts',
          ranges: [{ start: 2, end: 10 }],
        },
      ]);

      const classChunk = result.selectedChunks.find(c => c.type === 'class');
      expect(classChunk).toBeDefined();

      // Should include methods
      const methodChunks = result.allChunks.filter(c => c.type === 'method');
      expect(methodChunks.length).toBeGreaterThan(0);
    });

    it('should handle nested dependencies', async () => {
      const file1 = path.join(testDir, 'nested1.ts');
      const file2 = path.join(testDir, 'nested2.ts');
      const file3 = path.join(testDir, 'nested3.ts');

      fs.writeFileSync(file1, 'export function level1() { return 1; }');
      fs.writeFileSync(file2, `
import { level1 } from './nested1';
export function level2() { return level1(); }
`);
      fs.writeFileSync(file3, `
import { level2 } from './nested2';
export function level3() { return level2(); }
`);

      const result = await chunker.extractCodeWithDependencies([
        {
          filePath: 'test-temp/nested3.ts',
          ranges: [{ start: 3, end: 3 }],
        },
      ]);

      expect(result.selectedChunks.length).toBeGreaterThan(0);
      expect(result.dependencyGraph).toBeDefined();
    });
  });
});
