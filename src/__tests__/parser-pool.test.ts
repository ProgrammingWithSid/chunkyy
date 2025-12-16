import { ParserPool } from '../utils/parser-pool';
import { ParserAdapter } from '../types';

describe('ParserPool', () => {
  let pool: ParserPool;

  beforeEach(() => {
    pool = new ParserPool(3); // Small pool size for testing
  });

  describe('getAdapter', () => {
    it('should create a new adapter when pool is empty', () => {
      const adapter = pool.getAdapter('typescript');
      expect(adapter).toBeDefined();
      expect(adapter).not.toBeNull();
    });

    it('should reuse adapter from pool when available', () => {
      const adapter1 = pool.getAdapter('typescript');
      pool.releaseAdapter('typescript', adapter1);

      const adapter2 = pool.getAdapter('typescript');
      expect(adapter2).toBe(adapter1);
    });

    it('should reuse adapter from pool when available', () => {
      const adapters: ParserAdapter[] = [];

      // Fill the pool
      for (let i = 0; i < 3; i++) {
        const adapter = pool.getAdapter('typescript');
        adapters.push(adapter);
        pool.releaseAdapter('typescript', adapter);
      }

      // Get one more - should reuse from pool
      const reused = pool.getAdapter('typescript');
      expect(adapters).toContain(reused);

      // When pool is full, new adapters are still created but not added back
      // Release the reused one back
      pool.releaseAdapter('typescript', reused);

      // Get adapter - should reuse from pool
      const reused2 = pool.getAdapter('typescript');
      expect(adapters).toContain(reused2);
    });

    it('should handle different parser types separately', () => {
      const tsAdapter = pool.getAdapter('typescript');
      const treeAdapter = pool.getAdapter('treesitter', 'test.ts');

      expect(tsAdapter).toBeDefined();
      expect(treeAdapter).toBeDefined();
      expect(tsAdapter).not.toBe(treeAdapter);
    });

    it('should track statistics correctly', () => {
      const stats1 = pool.getStats();
      expect(stats1.created).toBe(0);
      expect(stats1.reused).toBe(0);

      // Create first adapter
      const adapter1 = pool.getAdapter('typescript');
      const stats2 = pool.getStats();
      expect(stats2.created).toBe(1);
      expect(stats2.reused).toBe(0);

      // Release and reuse
      pool.releaseAdapter('typescript', adapter1);
      pool.getAdapter('typescript');
      const stats3 = pool.getStats();
      expect(stats3.created).toBe(1);
      expect(stats3.reused).toBe(1);
      expect(stats3.hitRate).toBeGreaterThan(0);
    });
  });

  describe('releaseAdapter', () => {
    it('should add adapter to pool when under max size', () => {
      const adapter = pool.getAdapter('typescript');
      pool.releaseAdapter('typescript', adapter);

      const stats = pool.getStats();
      expect(stats.released).toBe(1);
    });

    it('should not add adapter when pool is full', () => {
      // Fill pool to max by releasing adapters
      const adapters: ParserAdapter[] = [];
      for (let i = 0; i < 3; i++) {
        const adapter = pool.getAdapter('typescript');
        adapters.push(adapter);
        pool.releaseAdapter('typescript', adapter);
      }

      // Verify pool has adapters (may be less than 3 if some were reused)
      const statsBefore = pool.getStats();
      const poolSizeBefore = statsBefore.poolSizes.find((p) => p.key === 'typescript')?.size || 0;
      expect(poolSizeBefore).toBeGreaterThan(0);
      expect(poolSizeBefore).toBeLessThanOrEqual(3);

      // Get all adapters from pool until empty
      const retrieved: ParserAdapter[] = [];
      let shouldContinue = true;
      while (shouldContinue) {
        const adapter = pool.getAdapter('typescript');
        if (adapters.includes(adapter)) {
          retrieved.push(adapter);
        } else {
          // New adapter created, break
          shouldContinue = false;
        }
        if (shouldContinue) {
          const currentStats = pool.getStats();
          const currentSize = currentStats.poolSizes.find((p) => p.key === 'typescript')?.size || 0;
          if (currentSize === 0) {
            shouldContinue = false;
          }
        }
      }

      // Release all retrieved adapters back - pool should fill to max
      retrieved.forEach((adapter) => pool.releaseAdapter('typescript', adapter));

      const statsAfter = pool.getStats();
      const poolSizeAfter = statsAfter.poolSizes.find((p) => p.key === 'typescript')?.size || 0;

      // Pool size should be at most max (3)
      expect(poolSizeAfter).toBeLessThanOrEqual(3);

      // Try to release one more adapter when pool is full
      const extraAdapter = pool.getAdapter('typescript');
      pool.releaseAdapter('typescript', extraAdapter);
      const statsAfterExtra = pool.getStats();
      const sizeAfterExtra =
        statsAfterExtra.poolSizes.find((p) => p.key === 'typescript')?.size || 0;

      // Size should not exceed max
      expect(sizeAfterExtra).toBeLessThanOrEqual(3);
    });
  });

  describe('clear', () => {
    it('should clear all pools and reset statistics', () => {
      const adapter1 = pool.getAdapter('typescript');
      const adapter2 = pool.getAdapter('treesitter', 'test.ts');

      pool.releaseAdapter('typescript', adapter1);
      pool.releaseAdapter('treesitter', adapter2, 'test.ts');

      const statsBefore = pool.getStats();
      expect(statsBefore.poolSizes.length).toBeGreaterThan(0);

      pool.clear();

      const statsAfter = pool.getStats();
      expect(statsAfter.created).toBe(0);
      expect(statsAfter.reused).toBe(0);
      expect(statsAfter.released).toBe(0);
      expect(statsAfter.poolSizes.length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct hit rate', () => {
      // Create and reuse
      const adapter1 = pool.getAdapter('typescript');
      pool.releaseAdapter('typescript', adapter1);
      const adapter2 = pool.getAdapter('typescript');
      pool.releaseAdapter('typescript', adapter2);

      const stats = pool.getStats();
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    it('should return pool sizes for each parser type', () => {
      const adapter1 = pool.getAdapter('typescript');
      const adapter2 = pool.getAdapter('treesitter', 'test.ts');

      pool.releaseAdapter('typescript', adapter1);
      pool.releaseAdapter('treesitter', adapter2, 'test.ts');

      const stats = pool.getStats();
      expect(stats.poolSizes.length).toBeGreaterThan(0);
      expect(stats.poolSizes.every((p) => p.size >= 0)).toBe(true);
    });
  });

  describe('pool key generation', () => {
    it('should generate different keys for different file types with treesitter', () => {
      const adapter1 = pool.getAdapter('treesitter', 'test.ts');
      pool.releaseAdapter('treesitter', adapter1, 'test.ts');

      const adapter2 = pool.getAdapter('treesitter', 'test.py');
      pool.releaseAdapter('treesitter', adapter2, 'test.py');

      const stats = pool.getStats();
      expect(stats.poolSizes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
