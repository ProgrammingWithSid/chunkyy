import { ASTCache } from '../utils/ast-cache';

describe('ASTCache', () => {
  let cache: ASTCache;
  const mockAST = { type: 'Program', body: [] };

  beforeEach(() => {
    cache = new ASTCache(1000, 10); // 1 second TTL, max 10 entries for testing
  });

  describe('get and set', () => {
    it('should store and retrieve cached AST', () => {
      const filePath = 'test.ts';
      const contentHash = 'abc123';

      cache.set(filePath, contentHash, mockAST);
      const retrieved = cache.get(filePath, contentHash);

      expect(retrieved).toBe(mockAST);
    });

    it('should return null for non-existent entry', () => {
      const retrieved = cache.get('nonexistent.ts', 'hash');
      expect(retrieved).toBeNull();
    });

    it('should return null for mismatched hash', () => {
      cache.set('test.ts', 'hash1', mockAST);
      const retrieved = cache.get('test.ts', 'hash2');

      expect(retrieved).toBeNull();
    });

    it('should return null for expired entry', async () => {
      const shortTTLCache = new ASTCache(100, 10); // 100ms TTL
      shortTTLCache.set('test.ts', 'hash1', mockAST);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      const retrieved = shortTTLCache.get('test.ts', 'hash1');
      expect(retrieved).toBeNull();
    });

    it('should handle multiple files', () => {
      const ast1 = { type: 'Program', body: ['file1'] };
      const ast2 = { type: 'Program', body: ['file2'] };

      cache.set('file1.ts', 'hash1', ast1);
      cache.set('file2.ts', 'hash2', ast2);

      expect(cache.get('file1.ts', 'hash1')).toBe(ast1);
      expect(cache.get('file2.ts', 'hash2')).toBe(ast2);
    });
  });

  describe('invalidate', () => {
    it('should remove specific entry from cache', () => {
      cache.set('test1.ts', 'hash1', mockAST);
      cache.set('test2.ts', 'hash2', mockAST);

      cache.invalidate('test1.ts');

      expect(cache.get('test1.ts', 'hash1')).toBeNull();
      expect(cache.get('test2.ts', 'hash2')).toBe(mockAST);
    });
  });

  describe('clear', () => {
    it('should remove all entries and reset statistics', () => {
      cache.set('test1.ts', 'hash1', mockAST);
      cache.set('test2.ts', 'hash2', mockAST);

      const statsBefore = cache.getStats();
      expect(statsBefore.size).toBe(2);

      cache.clear();

      const statsAfter = cache.getStats();
      expect(statsAfter.size).toBe(0);
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
      expect(cache.get('test1.ts', 'hash1')).toBeNull();
    });
  });

  describe('eviction', () => {
    it('should evict oldest entry when cache is full', () => {
      const smallCache = new ASTCache(1000, 3); // Max 3 entries

      // Fill cache
      const ast1 = { type: 'Program', body: ['file1'] };
      const ast2 = { type: 'Program', body: ['file2'] };
      const ast3 = { type: 'Program', body: ['file3'] };
      const ast4 = { type: 'Program', body: ['file4'] };

      smallCache.set('file1.ts', 'hash1', ast1);
      // Small delay to ensure different timestamps
      const delay = () => new Promise((resolve) => setTimeout(resolve, 10));

      return delay()
        .then(() => {
          smallCache.set('file2.ts', 'hash2', ast2);
          return delay();
        })
        .then(() => {
          smallCache.set('file3.ts', 'hash3', ast3);
          return delay();
        })
        .then(() => {
          // Add one more - should evict oldest (file1.ts)
          smallCache.set('file4.ts', 'hash4', ast4);

          const stats = smallCache.getStats();
          expect(stats.size).toBe(3);
          expect(stats.evictions).toBeGreaterThan(0);
          // file1 should be evicted (oldest)
          expect(smallCache.get('file1.ts', 'hash1')).toBeNull();
          // file4 should be present (newest)
          expect(smallCache.get('file4.ts', 'hash4')).toBeDefined();
        });
    });

    it('should evict oldest entry (not LRU)', () => {
      const smallCache = new ASTCache(1000, 2);

      const ast1 = { type: 'Program', body: ['file1'] };
      const ast2 = { type: 'Program', body: ['file2'] };
      const ast3 = { type: 'Program', body: ['file3'] };

      smallCache.set('file1.ts', 'hash1', ast1);

      return new Promise((resolve) => setTimeout(resolve, 10))
        .then(() => {
          smallCache.set('file2.ts', 'hash2', ast2);

          // Access file1 - but eviction is based on timestamp, not access
          smallCache.get('file1.ts', 'hash1');

          return new Promise((resolve) => setTimeout(resolve, 10));
        })
        .then(() => {
          // Add file3 - should evict oldest by timestamp (file1)
          smallCache.set('file3.ts', 'hash3', ast3);

          // file1 should be evicted (oldest timestamp)
          expect(smallCache.get('file1.ts', 'hash1')).toBeNull();
          // file2 and file3 should be present
          expect(smallCache.get('file2.ts', 'hash2')).toBeDefined();
          expect(smallCache.get('file3.ts', 'hash3')).toBeDefined();
        });
    });
  });

  describe('getStats', () => {
    it('should track hits and misses correctly', () => {
      cache.set('test.ts', 'hash1', mockAST);

      // Miss
      cache.get('nonexistent.ts', 'hash');
      // Hit
      cache.get('test.ts', 'hash1');
      // Miss (wrong hash)
      cache.get('test.ts', 'wronghash');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1 / 3, 2);
    });

    it('should return correct cache size', () => {
      expect(cache.getStats().size).toBe(0);

      cache.set('file1.ts', 'hash1', mockAST);
      expect(cache.getStats().size).toBe(1);

      cache.set('file2.ts', 'hash2', mockAST);
      expect(cache.getStats().size).toBe(2);
    });

    it('should return max size', () => {
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(10);
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hashes for same content', () => {
      const content = 'const x = 1;';
      const hash1 = ASTCache.generateContentHash(content);
      const hash2 = ASTCache.generateContentHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16); // First 16 chars of SHA256
    });

    it('should generate different hashes for different content', () => {
      const hash1 = ASTCache.generateContentHash('const x = 1;');
      const hash2 = ASTCache.generateContentHash('const y = 2;');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateFileHash', () => {
    it('should generate hash based on file stats', () => {
      const hash1 = ASTCache.generateFileHash('test.ts', process.cwd());
      const hash2 = ASTCache.generateFileHash('test.ts', process.cwd());

      // Should be consistent for same file
      expect(hash1).toBe(hash2);
    });

    it('should return empty string for non-existent file', () => {
      const hash = ASTCache.generateFileHash('nonexistent-file.ts', process.cwd());
      expect(hash).toBe('');
    });
  });
});
