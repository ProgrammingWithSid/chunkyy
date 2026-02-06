import { generateChunkHash, generateChunkId } from '../../utils/hash';

describe('Hash Utilities', () => {
  describe('generateChunkHash', () => {
    it('should generate consistent hash for same input', () => {
      const hash1 = generateChunkHash('test code', 'file.ts', { startLine: 1, endLine: 10 });
      const hash2 = generateChunkHash('test code', 'file.ts', { startLine: 1, endLine: 10 });

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = generateChunkHash('code1', 'file.ts', { startLine: 1, endLine: 10 });
      const hash2 = generateChunkHash('code2', 'file.ts', { startLine: 1, endLine: 10 });

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different ranges', () => {
      const hash1 = generateChunkHash('test code', 'file.ts', { startLine: 1, endLine: 10 });
      const hash2 = generateChunkHash('test code', 'file.ts', { startLine: 1, endLine: 20 });

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different files', () => {
      const hash1 = generateChunkHash('test code', 'file1.ts', { startLine: 1, endLine: 10 });
      const hash2 = generateChunkHash('test code', 'file2.ts', { startLine: 1, endLine: 10 });

      expect(hash1).not.toBe(hash2);
    });

    it('should return 16 character hex string', () => {
      const hash = generateChunkHash('test', 'file.ts', { startLine: 1, endLine: 1 });
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('generateChunkId', () => {
    it('should generate consistent ID for same input', () => {
      const id1 = generateChunkId('file.ts', 'functionName', 'function');
      const id2 = generateChunkId('file.ts', 'functionName', 'function');

      expect(id1).toBe(id2);
    });

    it('should generate different ID for different names', () => {
      const id1 = generateChunkId('file.ts', 'function1', 'function');
      const id2 = generateChunkId('file.ts', 'function2', 'function');

      expect(id1).not.toBe(id2);
    });

    it('should generate different ID for different types', () => {
      const id1 = generateChunkId('file.ts', 'name', 'function');
      const id2 = generateChunkId('file.ts', 'name', 'class');

      expect(id1).not.toBe(id2);
    });

    it('should normalize file paths', () => {
      const id1 = generateChunkId('file.ts', 'name', 'function');
      const id2 = generateChunkId('file\\path.ts', 'name', 'function');

      // Should normalize backslashes
      expect(id1).not.toBe(id2);
    });

    it('should return 16 character hex string', () => {
      const id = generateChunkId('file.ts', 'name', 'function');
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should handle qualified names with dots', () => {
      const id = generateChunkId('file.ts', 'Class.method', 'method');
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});
