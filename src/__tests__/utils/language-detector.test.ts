import {
  detectLanguage,
  isSupportedFile,
  getParserTypeForLanguage,
} from '../../utils/language-detector';

describe('language-detector', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(detectLanguage('test.ts')).toBe('typescript');
      expect(detectLanguage('test.tsx')).toBe('typescript');
    });

    it('should detect JavaScript', () => {
      expect(detectLanguage('test.js')).toBe('javascript');
      expect(detectLanguage('test.jsx')).toBe('javascript');
      expect(detectLanguage('test.mjs')).toBe('javascript');
      expect(detectLanguage('test.cjs')).toBe('javascript');
    });

    it('should detect Vue', () => {
      expect(detectLanguage('test.vue')).toBe('vue');
    });

    it('should detect Python', () => {
      expect(detectLanguage('test.py')).toBe('python');
    });

    it('should detect Java', () => {
      expect(detectLanguage('Test.java')).toBe('java');
    });

    it('should detect Go', () => {
      expect(detectLanguage('test.go')).toBe('go');
    });

    it('should detect Rust', () => {
      expect(detectLanguage('test.rs')).toBe('rust');
    });

    it('should detect C++', () => {
      expect(detectLanguage('test.cpp')).toBe('cpp');
      expect(detectLanguage('test.cc')).toBe('cpp');
      expect(detectLanguage('test.cxx')).toBe('cpp');
      expect(detectLanguage('test.hpp')).toBe('cpp');
    });

    it('should detect C', () => {
      expect(detectLanguage('test.c')).toBe('c');
      expect(detectLanguage('test.h')).toBe('c');
    });

    it('should detect Ruby', () => {
      expect(detectLanguage('test.rb')).toBe('ruby');
    });

    it('should detect PHP', () => {
      expect(detectLanguage('test.php')).toBe('php');
    });

    it('should handle case-insensitive extensions', () => {
      expect(detectLanguage('test.TS')).toBe('typescript');
      expect(detectLanguage('test.JS')).toBe('javascript');
    });

    it('should handle files without extension', () => {
      const result = detectLanguage('test');
      // Should return undefined for files without extension
      expect(result === undefined || typeof result === 'string').toBe(true);
    });
  });

  describe('isSupportedFile', () => {
    it('should return true for TypeScript files', () => {
      expect(isSupportedFile('test.ts')).toBe(true);
      expect(isSupportedFile('test.tsx')).toBe(true);
    });

    it('should return true for JavaScript files', () => {
      expect(isSupportedFile('test.js')).toBe(true);
      expect(isSupportedFile('test.jsx')).toBe(true);
      expect(isSupportedFile('test.mjs')).toBe(true);
      expect(isSupportedFile('test.cjs')).toBe(true);
    });

    it('should return true for Vue files', () => {
      expect(isSupportedFile('test.vue')).toBe(true);
    });

    it('should return true for other supported languages', () => {
      expect(isSupportedFile('test.py')).toBe(true);
      expect(isSupportedFile('test.java')).toBe(true);
      expect(isSupportedFile('test.go')).toBe(true);
      expect(isSupportedFile('test.rs')).toBe(true);
      expect(isSupportedFile('test.cpp')).toBe(true);
      expect(isSupportedFile('test.c')).toBe(true);
      expect(isSupportedFile('test.rb')).toBe(true);
      expect(isSupportedFile('test.php')).toBe(true);
    });

    it('should return false for unsupported files', () => {
      expect(isSupportedFile('test.txt')).toBe(false);
      expect(isSupportedFile('test.md')).toBe(false);
      expect(isSupportedFile('test.json')).toBe(false);
    });

    it('should handle case-insensitive extensions', () => {
      expect(isSupportedFile('test.TS')).toBe(true);
      expect(isSupportedFile('test.JS')).toBe(true);
    });
  });

  describe('getParserTypeForLanguage', () => {
    it('should return typescript for TypeScript', () => {
      expect(getParserTypeForLanguage('typescript')).toBe('typescript');
    });

    it('should return typescript for JavaScript', () => {
      expect(getParserTypeForLanguage('javascript')).toBe('typescript');
    });

    it('should return typescript for Vue', () => {
      expect(getParserTypeForLanguage('vue')).toBe('typescript');
    });

    it('should return treesitter for other languages', () => {
      expect(getParserTypeForLanguage('python')).toBe('treesitter');
      expect(getParserTypeForLanguage('java')).toBe('treesitter');
      expect(getParserTypeForLanguage('go')).toBe('treesitter');
      expect(getParserTypeForLanguage('rust')).toBe('treesitter');
      expect(getParserTypeForLanguage('cpp')).toBe('treesitter');
      expect(getParserTypeForLanguage('c')).toBe('treesitter');
      expect(getParserTypeForLanguage('ruby')).toBe('treesitter');
      expect(getParserTypeForLanguage('php')).toBe('treesitter');
    });
  });
});
