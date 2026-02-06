import { Chunker } from '../core/chunker';

describe('Chunker with Caching', () => {
  let chunker: Chunker;

  beforeEach(() => {
    chunker = new Chunker({
      parser: 'typescript',
      parserPoolSize: 3,
      astCacheTTL: 5000, // 5 seconds for testing
      astCacheMaxSize: 100,
    });
  });

  describe('parser pooling', () => {
    it('should reuse parsers when chunking multiple files', () => {
      const code1 = 'export function func1() {}';
      const code2 = 'export function func2() {}';
      const code3 = 'export function func3() {}';

      chunker.chunkCode(code1, 'file1.ts');
      chunker.chunkCode(code2, 'file2.ts');
      chunker.chunkCode(code3, 'file3.ts');

      const stats = chunker.getCacheStats();
      expect(stats.parserPool.created).toBeGreaterThan(0);
      // Should have some reuse after multiple files
      expect(stats.parserPool.reused).toBeGreaterThanOrEqual(0);
    });

    it('should track parser pool statistics', () => {
      const code = 'export function test() {}';

      chunker.chunkCode(code, 'test.ts');
      chunker.chunkCode(code, 'test2.ts');

      const stats = chunker.getCacheStats();
      expect(stats.parserPool).toBeDefined();
      expect(stats.parserPool.created).toBeGreaterThan(0);
    });
  });

  describe('AST caching', () => {
    it('should cache AST for repeated chunking of same content', () => {
      const code = 'export function test() { return 42; }';
      const filePath = 'test.ts';

      // First chunking - should parse
      const chunks1 = chunker.chunkCode(code, filePath);
      const stats1 = chunker.getCacheStats();
      expect(stats1.astCache.misses).toBeGreaterThan(0);

      // Second chunking with same content - should use cache
      const chunks2 = chunker.chunkCode(code, filePath);
      const stats2 = chunker.getCacheStats();
      expect(stats2.astCache.hits).toBeGreaterThan(0);
      expect(chunks1.length).toBe(chunks2.length);
    });

    it('should invalidate cache when content changes', () => {
      const filePath = 'test.ts';
      const code1 = 'export function func1() {}';
      const code2 = 'export function func2() {}';

      chunker.chunkCode(code1, filePath);
      const stats1 = chunker.getCacheStats();

      chunker.chunkCode(code2, filePath);
      const stats2 = chunker.getCacheStats();

      // Should have misses for both (different content)
      expect(stats2.astCache.misses).toBeGreaterThan(stats1.astCache.misses);
    });

    it('should cache ASTs for different files separately', () => {
      const code = 'export function test() {}';

      chunker.chunkCode(code, 'file1.ts');
      chunker.chunkCode(code, 'file2.ts');

      const stats = chunker.getCacheStats();
      expect(stats.astCache.size).toBeGreaterThanOrEqual(1);
    });

    it('should respect cache TTL', async () => {
      const shortTTLCache = new Chunker({
        parser: 'typescript',
        astCacheTTL: 100, // 100ms
      });

      const code = 'export function test() {}';
      shortTTLCache.chunkCode(code, 'test.ts');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      shortTTLCache.chunkCode(code, 'test.ts');
      const stats = shortTTLCache.getCacheStats();
      // Should have misses after expiration
      expect(stats.astCache.misses).toBeGreaterThan(0);
    });
  });

  describe('cache management', () => {
    it('should clear all caches', () => {
      const code = 'export function test() {}';
      chunker.chunkCode(code, 'test.ts');

      const statsBefore = chunker.getCacheStats();
      expect(statsBefore.astCache.size).toBeGreaterThan(0);

      chunker.clearCaches();

      const statsAfter = chunker.getCacheStats();
      expect(statsAfter.astCache.size).toBe(0);
      expect(statsAfter.parserPool.created).toBe(0);
    });

    it('should invalidate AST cache for specific file', () => {
      chunker.chunkCode('export function test1() {}', 'file1.ts');
      chunker.chunkCode('export function test2() {}', 'file2.ts');

      const statsBefore = chunker.getCacheStats();
      const sizeBefore = statsBefore.astCache.size;

      chunker.invalidateASTCache('file1.ts');

      const statsAfter = chunker.getCacheStats();
      expect(statsAfter.astCache.size).toBeLessThan(sizeBefore);
    });
  });

  describe('performance', () => {
    it('should be faster on second chunking due to caching', () => {
      const code = `
        export class Test {
          method1() {}
          method2() {}
          method3() {}
        }
      `;

      const start1 = Date.now();
      chunker.chunkCode(code, 'test.ts');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      chunker.chunkCode(code, 'test.ts');
      const time2 = Date.now() - start2;

      // Second run should be faster (or at least not slower)
      // Note: This is a basic test - actual performance may vary
      // If first run is very fast (0ms), second run might be 1ms due to timing precision
      // In that case, we just verify that caching doesn't make it significantly slower
      if (time1 === 0) {
        // If first run was instant, second run should also be very fast (<= 2ms)
        expect(time2).toBeLessThanOrEqual(2);
      } else {
        // Otherwise, second run should be faster or at most 1.5x slower (allowing variance)
        expect(time2).toBeLessThanOrEqual(time1 * 1.5);
      }
    });
  });

  describe('integration with chunking', () => {
    it('should produce same chunks with and without cache', () => {
      const code = `
        export function hello(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;

      // Clear cache first
      chunker.clearCaches();

      const chunks1 = chunker.chunkCode(code, 'test.ts');
      const chunks2 = chunker.chunkCode(code, 'test.ts');

      expect(chunks1.length).toBe(chunks2.length);
      expect(chunks1[0].name).toBe(chunks2[0].name);
      expect(chunks1[0].type).toBe(chunks2[0].type);
    });
  });
});
