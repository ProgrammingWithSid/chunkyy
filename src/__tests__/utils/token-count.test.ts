import { estimateTokenCount, splitIntoTokens } from '../../utils/token-count';

describe('Token Count Utilities', () => {
  describe('estimateTokenCount', () => {
    it('should estimate tokens for simple code', () => {
      const code = 'const x = 1;';
      const tokens = estimateTokenCount(code);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should return approximately 1/4 of character count', () => {
      const code = 'a'.repeat(100);
      const tokens = estimateTokenCount(code);

      // Should be approximately 25 (100/4)
      expect(tokens).toBeGreaterThanOrEqual(20);
      expect(tokens).toBeLessThanOrEqual(30);
    });

    it('should handle empty string', () => {
      const tokens = estimateTokenCount('');
      expect(tokens).toBe(0);
    });

    it('should handle multiline code', () => {
      const code = `function test() {
  return 1;
}`;
      const tokens = estimateTokenCount(code);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should round up fractional results', () => {
      const code = 'abc'; // 3 chars = 0.75 tokens, should round to 1
      const tokens = estimateTokenCount(code);
      expect(tokens).toBe(1);
    });
  });

  describe('splitIntoTokens', () => {
    it('should split code into tokens', () => {
      const code = 'const x = 1;';
      const tokens = splitIntoTokens(code);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should filter out empty tokens', () => {
      const code = 'const   x   =   1;';
      const tokens = splitIntoTokens(code);

      tokens.forEach((token) => {
        expect(token.trim().length).toBeGreaterThan(0);
      });
    });

    it('should handle operators as separate tokens', () => {
      const code = 'x + y';
      const tokens = splitIntoTokens(code);

      expect(tokens).toContain('+');
    });

    it('should handle punctuation', () => {
      const code = 'function test() { }';
      const tokens = splitIntoTokens(code);

      expect(tokens.some((t) => t.includes('(') || t.includes(')'))).toBe(true);
    });

    it('should handle empty string', () => {
      const tokens = splitIntoTokens('');
      expect(tokens).toEqual([]);
    });
  });
});
