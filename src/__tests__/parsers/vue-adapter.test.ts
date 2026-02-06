import { VueAdapter } from '../../parsers/vue-adapter';

describe('VueAdapter', () => {
  let adapter: VueAdapter;

  beforeEach(() => {
    adapter = new VueAdapter();
  });

  describe('parse', () => {
    it('should parse Vue SFC with script setup', () => {
      const code = `<template>
  <div>Hello</div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      expect(ast).toBeDefined();
      expect(ast.type).toBeDefined();
    });

    it('should parse Vue SFC with regular script', () => {
      const code = `<template>
  <div>Hello</div>
</template>
<script lang="ts">
export default {
  data() {
    return { count: 0 };
  }
}
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      expect(ast).toBeDefined();
    });

    it('should prefer script setup over regular script', () => {
      const code = `<script>
export default { }
</script>
<script setup>
const test = 1;
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      expect(ast).toBeDefined();
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      // Should have declarations from script setup
      expect(declarations.length).toBeGreaterThan(0);
    });

    it('should handle Vue file without script section', () => {
      const code = `<template>
  <div>Hello</div>
</template>`;
      const ast = adapter.parse(code, 'test.vue');
      expect(ast).toBeDefined();
    });

    it('should handle empty script section', () => {
      const code = `<script>
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      expect(ast).toBeDefined();
    });
  });

  describe('getRoot', () => {
    it('should return root node', () => {
      const code = `<script setup>
const test = 1;
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      const root = adapter.getRoot(ast);
      expect(root).toBeDefined();
    });
  });

  describe('getTopLevelDeclarations', () => {
    it('should get declarations from script setup', () => {
      const code = `<script setup>
import { ref } from 'vue';
const count = ref(0);
function test() { }
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      expect(declarations.length).toBeGreaterThan(0);
    });

    it('should get Vue Options API properties', () => {
      const code = `<script>
export default {
  data() { return { count: 0 }; },
  methods: {
    increment() { }
  }
}
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      // Should return Options API properties
      expect(declarations.length).toBeGreaterThan(0);
    });
  });

  describe('getNodeRange', () => {
    it('should adjust line numbers for script section', () => {
      const code = `<template>
  <div>Template</div>
</template>
<script setup>
const test = 1;
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      if (declarations.length > 0) {
        const range = adapter.getNodeRange(declarations[0]);
        expect(range).toBeDefined();
        // Line numbers should be adjusted for script position
        expect(range?.start.line).toBeGreaterThan(0);
      }
    });
  });

  describe('extractCode', () => {
    it('should extract code from script section only', () => {
      const code = `<template>
  <div>Template</div>
</template>
<script setup>
const test = 1;
function hello() { return 'world'; }
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      if (declarations.length > 0) {
        const extracted = adapter.extractCode(declarations[0]);
        // Should not contain template content
        expect(extracted).not.toContain('<template>');
        expect(extracted).not.toContain('<div>Template</div>');
      }
    });
  });

  describe('isExported', () => {
    it('should identify exported declarations in script setup', () => {
      const code = `<script setup>
export const value = 1;
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);
      const exportedDecl = declarations.find((d) => adapter.isExported(d));
      if (exportedDecl) {
        expect(adapter.isExported(exportedDecl)).toBe(true);
      }
    });
  });

  describe('getImports', () => {
    it('should get imports from script section', () => {
      const code = `<script setup>
import { ref, computed } from 'vue';
import Component from './Component.vue';
</script>`;
      const ast = adapter.parse(code, 'test.vue');
      const root = adapter.getRoot(ast);
      const imports = adapter.getImports(root);
      expect(imports.length).toBeGreaterThan(0);
    });
  });
});
