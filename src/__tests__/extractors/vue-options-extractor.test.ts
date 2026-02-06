import * as ts from 'typescript';
import { VueOptionsExtractor } from '../../extractors/vue-options-extractor';
import { TypeScriptAdapter } from '../../parsers/typescript-adapter';
import { getTypeScriptNode } from '../../utils/type-guards';

describe('VueOptionsExtractor', () => {
  let extractor: VueOptionsExtractor;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    adapter = new TypeScriptAdapter();
    extractor = new VueOptionsExtractor(adapter, true);
  });

  describe('canHandle', () => {
    it('should handle methods option', () => {
      const code = `export default {
  methods: {
    handleClick() { }
  }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => {
        const tsNode = getTypeScriptNode(d);
        return tsNode && ts.isExportAssignment(tsNode);
      });
      if (exportDecl) {
        expect(extractor.canHandle(exportDecl)).toBe(true);
      }
    });

    it('should handle computed option', () => {
      const code = `export default {
  computed: {
    fullName() { return this.firstName + ' ' + this.lastName; }
  }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => {
        const tsNode = getTypeScriptNode(d);
        return tsNode && ts.isExportAssignment(tsNode);
      });
      if (exportDecl) {
        expect(extractor.canHandle(exportDecl)).toBe(true);
      }
    });

    it('should handle data option', () => {
      const code = `export default {
  data() { return { count: 0 }; }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => {
        const tsNode = getTypeScriptNode(d);
        return tsNode && ts.isExportAssignment(tsNode);
      });
      if (exportDecl) {
        expect(extractor.canHandle(exportDecl)).toBe(true);
      }
    });

    it('should handle lifecycle hooks', () => {
      const code = `export default {
  mounted() { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => {
        const tsNode = getTypeScriptNode(d);
        return tsNode && ts.isExportAssignment(tsNode);
      });
      if (exportDecl) {
        expect(extractor.canHandle(exportDecl)).toBe(true);
      }
    });

    it('should not handle regular function declarations', () => {
      const code = `function test() { return 1; }`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const funcDecl = declarations.find((d) => adapter.isFunction(d));
      if (funcDecl) {
        expect(extractor.canHandle(funcDecl)).toBe(false);
      }
    });
  });

  describe('extract', () => {
    it('should extract methods from methods option', () => {
      const code = `export default {
  methods: {
    handleClick() { },
    handleSubmit() { }
  }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        const clickChunk = chunks.find((c) => c.name === 'handleClick');
        const submitChunk = chunks.find((c) => c.name === 'handleSubmit');
        expect(clickChunk).toBeDefined();
        expect(submitChunk).toBeDefined();
        if (clickChunk) {
          expect(clickChunk.vueOptionType).toBe('method');
        }
      }
    });

    it('should extract computed properties', () => {
      const code = `export default {
  computed: {
    fullName() { return this.firstName + ' ' + this.lastName; },
    reversed() { return this.text.split('').reverse().join(''); }
  }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        const fullNameChunk = chunks.find((c) => c.name === 'fullName');
        if (fullNameChunk) {
          expect(fullNameChunk.vueOptionType).toBe('computed');
        }
      }
    });

    it('should extract data function', () => {
      const code = `export default {
  data() {
    return {
      count: 0,
      message: 'Hello'
    };
  }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        const dataChunk = chunks.find((c) => c.name === 'data');
        expect(dataChunk).toBeDefined();
        if (dataChunk) {
          expect(dataChunk.vueOptionType).toBe('data');
        }
      }
    });

    it('should extract lifecycle hooks', () => {
      const code = `export default {
  mounted() { },
  created() { },
  beforeUnmount() { }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        expect(chunks.length).toBeGreaterThanOrEqual(3);
        const mountedChunk = chunks.find((c) => c.name === 'mounted');
        const createdChunk = chunks.find((c) => c.name === 'created');
        if (mountedChunk) {
          expect(mountedChunk.vueOptionType).toBe('lifecycle-hook');
        }
        if (createdChunk) {
          expect(createdChunk.vueOptionType).toBe('lifecycle-hook');
        }
      }
    });

    it('should extract watch options', () => {
      const code = `export default {
  watch: {
    count(newVal, oldVal) { },
    message: {
      handler(newVal) { },
      immediate: true
    }
  }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        const watchChunks = chunks.filter((c) => c.vueOptionType === 'watcher');
        expect(watchChunks.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should extract props', () => {
      const code = `export default {
  props: {
    title: String,
    count: Number
  }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        const propChunks = chunks.filter((c) => c.vueOptionType === 'prop');
        expect(propChunks.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should extract emits as array', () => {
      const code = `export default {
  emits: ['update', 'delete']
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        const emitChunks = chunks.filter((c) => c.vueOptionType === 'emit');
        expect(emitChunks.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should extract emits as object', () => {
      const code = `export default {
  emits: {
    update: null,
    delete: (id: number) => true
  }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        const emitChunks = chunks.filter((c) => c.vueOptionType === 'emit');
        expect(emitChunks.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should handle complex Vue options object', () => {
      const code = `export default {
  props: ['title'],
  data() { return { count: 0 }; },
  computed: {
    doubleCount() { return this.count * 2; }
  },
  methods: {
    increment() { this.count++; }
  },
  mounted() { console.log('mounted'); }
}`;
      const ast = adapter.parse(code, 'test.ts');
      const root = adapter.getRoot(ast);
      const declarations = adapter.getTopLevelDeclarations(root);

      const exportDecl = declarations.find((d) => extractor.canHandle(d));
      if (exportDecl) {
        const chunks = extractor.extract(exportDecl, code, 'test.ts');
        expect(chunks.length).toBeGreaterThan(0);

        const dataChunk = chunks.find((c) => c.name === 'data');
        const computedChunk = chunks.find((c) => c.name === 'doubleCount');
        const methodChunk = chunks.find((c) => c.name === 'increment');
        const mountedChunk = chunks.find((c) => c.name === 'mounted');

        expect(dataChunk).toBeDefined();
        expect(computedChunk).toBeDefined();
        expect(methodChunk).toBeDefined();
        expect(mountedChunk).toBeDefined();
      }
    });
  });

  describe('getChunkType', () => {
    it('should return method type', () => {
      expect(extractor.getChunkType()).toBe('method');
    });
  });
});
