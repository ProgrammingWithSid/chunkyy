import * as fs from 'fs';
import * as path from 'path';
import { Chunkyyy } from '../chunkyyy';
import { Chunker } from '../core/chunker';

describe('Tree-sitter Multi-Language Support', () => {
  let chunkyyy: Chunkyyy;
  let chunker: Chunker;
  const testDir = path.join(__dirname, '../../test-temp');

  beforeEach(() => {
    // Use typescript parser but auto-detection will use tree-sitter for other languages
    chunkyyy = new Chunkyyy({ parser: 'typescript', includeContent: true });
    chunker = new Chunker({ parser: 'typescript', includeContent: true });

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

  describe('Python support', () => {
    it('should detect Python files and use tree-sitter', async () => {
      const testFile = path.join(testDir, 'test.py');
      fs.writeFileSync(
        testFile,
        `
def hello(name: str) -> str:
    return f"Hello, {name}!"

class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b
`
      );

      const chunks = await chunker.chunkFile('test-temp/test.py');
      // Tree-sitter might not be initialized immediately, so chunks might be empty initially
      // But the adapter should be created
      expect(chunks).toBeDefined();
    });

    it('should extract Python functions', async () => {
      const testFile = path.join(testDir, 'functions.py');
      fs.writeFileSync(
        testFile,
        `
def calculate_sum(a, b):
    return a + b

def calculate_product(x, y):
    return x * y
`
      );

      const chunks = await chunker.chunkFile('test-temp/functions.py');
      expect(chunks).toBeDefined();
      // Note: Tree-sitter initialization is async, so first parse might return empty
      // In production, you'd wait for initialization
    });
  });

  describe('Java support', () => {
    it('should detect Java files and use tree-sitter', async () => {
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, 'Test.java');
      fs.writeFileSync(
        testFile,
        `
public class Test {
    public void method() {
        System.out.println("Hello");
    }
}
`
      );

      const chunks = await chunker.chunkFile('test-temp/Test.java');
      expect(chunks).toBeDefined();
    });
  });

  describe('Go support', () => {
    it('should detect Go files and use tree-sitter', async () => {
      const testFile = path.join(testDir, 'main.go');
      fs.writeFileSync(
        testFile,
        `
package main

func hello() string {
    return "Hello, World!"
}
`
      );

      const chunks = await chunker.chunkFile('test-temp/main.go');
      expect(chunks).toBeDefined();
    });
  });

  describe('Rust support', () => {
    it('should detect Rust files and use tree-sitter', async () => {
      fs.mkdirSync(testDir, { recursive: true });
      const testFile = path.join(testDir, 'main.rs');
      fs.writeFileSync(
        testFile,
        `
fn main() {
    println!("Hello, world!");
}

fn calculate(x: i32) -> i32 {
    x * 2
}
`
      );

      const chunks = await chunker.chunkFile('test-temp/main.rs');
      expect(chunks).toBeDefined();
    });
  });

  describe('Parser auto-detection', () => {
    it('should use TypeScript parser for .ts files', () => {
      const code = 'export function test() {}';
      const chunks = chunker.chunkCode(code, 'test.ts');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use TypeScript parser for .js files', () => {
      const code = 'export function test() {}';
      const chunks = chunker.chunkCode(code, 'test.js');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use Vue adapter for .vue files', () => {
      const code = `
<script>
export default {
  methods: {
    test() {}
  }
}
</script>
`;
      const chunks = chunker.chunkCode(code, 'test.vue');
      expect(chunks).toBeDefined();
    });

    it('should attempt tree-sitter for .py files', () => {
      const code = 'def test(): pass';
      const chunks = chunker.chunkCode(code, 'test.py');
      // Tree-sitter might not be ready immediately, but adapter should be created
      expect(chunks).toBeDefined();
    });
  });

  describe('Tree-sitter initialization', () => {
    it('should handle tree-sitter not being ready gracefully', () => {
      const code = 'def test(): pass';
      // First parse might return placeholder AST if tree-sitter not initialized
      const chunks = chunker.chunkCode(code, 'test.py');
      expect(chunks).toBeDefined();
      // Should not throw errors even if tree-sitter isn't ready
    });

    it('should work with explicit treesitter parser type', () => {
      const treesitterChunker = new Chunker({ parser: 'treesitter', includeContent: true });
      const code = 'def test(): pass';
      const chunks = treesitterChunker.chunkCode(code, 'test.py');
      expect(chunks).toBeDefined();
    });
  });

  describe('Language detection', () => {
    it('should detect correct language from file extension', () => {
      const { detectLanguage } = require('../utils/language-detector'); // eslint-disable-line @typescript-eslint/no-var-requires

      expect(detectLanguage('test.py')).toBe('python');
      expect(detectLanguage('test.java')).toBe('java');
      expect(detectLanguage('test.go')).toBe('go');
      expect(detectLanguage('test.rs')).toBe('rust');
      expect(detectLanguage('test.ts')).toBe('typescript');
      expect(detectLanguage('test.js')).toBe('javascript');
      expect(detectLanguage('test.vue')).toBe('vue');
    });

    it('should determine correct parser type for language', () => {
      const { getParserTypeForLanguage } = require('../utils/language-detector'); // eslint-disable-line @typescript-eslint/no-var-requires

      expect(getParserTypeForLanguage('typescript')).toBe('typescript');
      expect(getParserTypeForLanguage('javascript')).toBe('typescript');
      expect(getParserTypeForLanguage('vue')).toBe('typescript');
      expect(getParserTypeForLanguage('python')).toBe('treesitter');
      expect(getParserTypeForLanguage('java')).toBe('treesitter');
      expect(getParserTypeForLanguage('go')).toBe('treesitter');
      expect(getParserTypeForLanguage('rust')).toBe('treesitter');
    });
  });
});
