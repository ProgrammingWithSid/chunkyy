import * as fs from 'fs';
import * as path from 'path';
import { Chunker } from '../core/chunker';

describe('Memory Optimization', () => {
  let chunkerWithContent: Chunker;
  let chunkerWithoutContent: Chunker;
  const testDir = path.join(__dirname, '../../test-temp');

  beforeEach(() => {
    chunkerWithContent = new Chunker({
      parser: 'typescript',
      includeContent: true,
    });
    chunkerWithoutContent = new Chunker({
      parser: 'typescript',
      includeContent: false,
    });

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

  describe('includeContent option', () => {
    it('should include content when includeContent is true', () => {
      const code = 'export function test() { return 42; }';
      const chunks = chunkerWithContent.chunkCode(code, 'test.ts');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBeDefined();
      expect(chunks[0].content).toContain('test');
    });

    it('should not include content when includeContent is false', () => {
      const code = 'export function test() { return 42; }';
      const chunks = chunkerWithoutContent.chunkCode(code, 'test.ts');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBeUndefined();
    });

    it('should still generate hash without content', () => {
      const code = 'export function test() { return 42; }';
      const chunks = chunkerWithoutContent.chunkCode(code, 'test.ts');

      expect(chunks[0].hash).toBeDefined();
      expect(chunks[0].hash.length).toBeGreaterThan(0);
    });
  });

  describe('getChunkContent', () => {
    it('should reconstruct content on demand', async () => {
      const testFile = path.join(testDir, 'reconstruct.ts');
      const code = `
export function test() {
  return 42;
}
`;
      fs.writeFileSync(testFile, code);

      const chunks = chunkerWithoutContent.chunkCode(code, 'test-temp/reconstruct.ts');
      expect(chunks[0].content).toBeUndefined();

      const content = await chunkerWithoutContent.getChunkContent(chunks[0]);
      expect(content).toBeDefined();
      expect(content).toContain('test');
    });

    it('should return existing content if available', async () => {
      const code = 'export function test() { return 42; }';
      const chunks = chunkerWithContent.chunkCode(code, 'test.ts');

      const content = await chunkerWithContent.getChunkContent(chunks[0]);
      expect(content).toBe(chunks[0].content);
    });
  });

  describe('memory efficiency', () => {
    it('should use less memory without content', () => {
      const code = `
export function a() { return 1; }
export function b() { return 2; }
export function c() { return 3; }
export function d() { return 4; }
export function e() { return 5; }
`;

      const chunksWith = chunkerWithContent.chunkCode(code, 'test.ts');
      const chunksWithout = chunkerWithoutContent.chunkCode(code, 'test.ts');

      // Both should have same number of chunks
      expect(chunksWith.length).toBe(chunksWithout.length);

      // But chunks without content should not have content property
      chunksWithout.forEach((chunk) => {
        expect(chunk.content).toBeUndefined();
      });

      // Chunks with content should have content
      chunksWith.forEach((chunk) => {
        expect(chunk.content).toBeDefined();
      });
    });
  });
});
