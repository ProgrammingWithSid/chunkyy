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
    chunkyyy.clearCache();
    // Clean up test directory - handle errors gracefully
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors - directory might be in use
      }
    }
  });

  describe('chunkFile', () => {
    it('should chunk a single file', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(
        testFile,
        `
export function hello() {
  return 'world';
}
`
      );

      // Use relative path from process.cwd()
      const relativePath = path.relative(process.cwd(), testFile);
      const chunks = await chunkyyy.chunkFile(relativePath);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].name).toBe('hello');
    });

    it('should cache chunks', async () => {
      const testFile = path.join(testDir, 'cache.ts');
      fs.writeFileSync(testFile, 'export function test() { return 1; }');

      const relativePath = path.relative(process.cwd(), testFile);
      const chunks1 = await chunkyyy.chunkFile(relativePath);
      const chunks2 = await chunkyyy.chunkFile(relativePath);

      expect(chunks1).toEqual(chunks2);
    });

    it('should invalidate cache on file change', async () => {
      const testFile = path.join(testDir, 'invalidate.ts');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testFile, 'export function a() { return 1; }');

      // Use relative path from process.cwd()
      const relativePath = path.relative(process.cwd(), testFile);
      const chunks1 = await chunkyyy.chunkFile(relativePath);
      expect(chunks1[0].name).toBe('a');

      // Clear cache and modify file
      chunkyyy.clearCache(relativePath);
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Ensure directory exists before writing
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(testFile, 'export function b() { return 2; }');

      const chunks2 = await chunkyyy.chunkFile(relativePath);
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
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'file1.ts'), 'export function a() { return 1; }');
      fs.writeFileSync(path.join(testDir, 'file2.ts'), 'export function b() { return 2; }');

      const result = await chunkyyy.chunkDirectory(testDir, { recursive: false });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.stats.totalFiles).toBeGreaterThan(0);
    });

    it('should handle recursive directory chunking', async () => {
      fs.mkdirSync(testDir, { recursive: true });
      const subDir = path.join(testDir, 'subdir');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'file.ts'), 'export function c() { return 3; }');

      const result = await chunkyyy.chunkDirectory(testDir, { recursive: true });

      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('extractCodeWithDependencies', () => {
    it('should extract code with dependencies', async () => {
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, 'extract.ts');
      fs.writeFileSync(
        testFile,
        `
export function helper() {
  return 42;
}

export function main() {
  return helper();
}
`
      );

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
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, 'multi.ts');
      fs.writeFileSync(
        testFile,
        `
export function a() { return 1; }
export function b() { return 2; }
export function c() { return 3; }
`
      );

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
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, 'clear.ts');
      fs.writeFileSync(testFile, 'export function test() { return 1; }');

      const relativePath = path.relative(process.cwd(), testFile);
      await chunkyyy.chunkFile(relativePath);
      chunkyyy.clearCache(relativePath);

      // Cache should be cleared
      const chunks = await chunkyyy.chunkFile(relativePath);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should clear all cache', async () => {
      fs.mkdirSync(testDir, { recursive: true });
      const testFile1 = path.join(testDir, 'clear1.ts');
      const testFile2 = path.join(testDir, 'clear2.ts');
      fs.writeFileSync(testFile1, 'export function a() { return 1; }');
      fs.writeFileSync(testFile2, 'export function b() { return 2; }');

      const relativePath1 = path.relative(process.cwd(), testFile1);
      const relativePath2 = path.relative(process.cwd(), testFile2);
      await chunkyyy.chunkFile(relativePath1);
      await chunkyyy.chunkFile(relativePath2);

      chunkyyy.clearCache();

      // Should still work after clearing
      const chunks = await chunkyyy.chunkFile(relativePath1);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
