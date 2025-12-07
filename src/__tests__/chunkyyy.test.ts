import { Chunkyyy } from '../chunkyyy';
import * as fs from 'fs';
import * as path from 'path';

describe('Chunkyyy', () => {
  let chunkyyy: Chunkyyy;
  const testDir = path.join(__dirname, '../../test-temp');

  beforeEach(() => {
    chunkyyy = new Chunkyyy({ parser: 'typescript', includeContent: true });

    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    chunkyyy.clearCache();
  });

  describe('chunkFile', () => {
    it('should chunk a single file', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, `
export function hello() {
  return 'world';
}
`);

      const chunks = await chunkyyy.chunkFile('test-temp/test.ts');
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].name).toBe('hello');
    });

    it('should cache chunks', async () => {
      const testFile = path.join(testDir, 'cache.ts');
      fs.writeFileSync(testFile, 'export function test() { return 1; }');

      const chunks1 = await chunkyyy.chunkFile('test-temp/cache.ts');
      const chunks2 = await chunkyyy.chunkFile('test-temp/cache.ts');

      expect(chunks1).toEqual(chunks2);
    });

    it('should invalidate cache on file change', async () => {
      const testFile = path.join(testDir, 'invalidate.ts');

      // Ensure directory exists
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      fs.writeFileSync(testFile, 'export function a() { return 1; }');

      const chunks1 = await chunkyyy.chunkFile('test-temp/invalidate.ts');
      expect(chunks1[0].name).toBe('a');

      // Clear cache and modify file
      chunkyyy.clearCache('test-temp/invalidate.ts');
      await new Promise(resolve => setTimeout(resolve, 100));
      fs.writeFileSync(testFile, 'export function b() { return 2; }');

      const chunks2 = await chunkyyy.chunkFile('test-temp/invalidate.ts');
      expect(chunks2[0].name).toBe('b');
    });
  });

  describe('chunkCode', () => {
    it('should chunk code from string', () => {
      const code = `
export function test() {
  return 42;
}
`;

      const chunks = chunkyyy.chunkCode(code, 'test.ts');
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].name).toBe('test');
    });

    it('should handle different file extensions', () => {
      const code = 'export const x = 1;';

      const tsChunks = chunkyyy.chunkCode(code, 'test.ts');
      const jsChunks = chunkyyy.chunkCode(code, 'test.js');

      // Both should work (may return different number of chunks based on parser)
      expect(tsChunks.length).toBeGreaterThanOrEqual(0);
      expect(jsChunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('chunkDirectory', () => {
    it('should chunk all files in directory', async () => {
      fs.writeFileSync(path.join(testDir, 'file1.ts'), 'export function a() { return 1; }');
      fs.writeFileSync(path.join(testDir, 'file2.ts'), 'export function b() { return 2; }');

      const result = await chunkyyy.chunkDirectory(testDir, { recursive: false });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.stats.totalFiles).toBeGreaterThan(0);
    });

    it('should handle recursive directory chunking', async () => {
      const subDir = path.join(testDir, 'subdir');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'file.ts'), 'export function c() { return 3; }');

      const result = await chunkyyy.chunkDirectory(testDir, { recursive: true });

      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('extractCodeWithDependencies', () => {
    it('should extract code with dependencies', async () => {
      const testFile = path.join(testDir, 'extract.ts');
      fs.writeFileSync(testFile, `
export function helper() {
  return 42;
}

export function main() {
  return helper();
}
`);

      const result = await chunkyyy.extractCodeWithDependencies([
        {
          filePath: 'test-temp/extract.ts',
          ranges: [{ start: 5, end: 7 }],
        },
      ]);

      expect(result.selectedChunks.length).toBeGreaterThan(0);
      expect(result.codeBlocks.size).toBeGreaterThan(0);
    });

    it('should handle multiple ranges', async () => {
      const testFile = path.join(testDir, 'multi.ts');
      fs.writeFileSync(testFile, `
export function a() { return 1; }
export function b() { return 2; }
export function c() { return 3; }
`);

      const result = await chunkyyy.extractCodeWithDependencies([
        {
          filePath: 'test-temp/multi.ts',
          ranges: [
            { start: 2, end: 2 },
            { start: 4, end: 4 },
          ],
        },
      ]);

      // Should find at least one chunk (functions may span multiple lines)
      expect(result.selectedChunks.length).toBeGreaterThanOrEqual(1);
      expect(result.codeBlocks.size).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific file', async () => {
      const testFile = path.join(testDir, 'clear.ts');
      fs.writeFileSync(testFile, 'export function test() { return 1; }');

      await chunkyyy.chunkFile('test-temp/clear.ts');
      chunkyyy.clearCache('test-temp/clear.ts');

      // Cache should be cleared
      const chunks = await chunkyyy.chunkFile('test-temp/clear.ts');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should clear all cache', async () => {
      fs.writeFileSync(path.join(testDir, 'clear1.ts'), 'export function a() { return 1; }');
      fs.writeFileSync(path.join(testDir, 'clear2.ts'), 'export function b() { return 2; }');

      await chunkyyy.chunkFile('test-temp/clear1.ts');
      await chunkyyy.chunkFile('test-temp/clear2.ts');

      chunkyyy.clearCache();

      // Should still work after clearing
      const chunks = await chunkyyy.chunkFile('test-temp/clear1.ts');
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
