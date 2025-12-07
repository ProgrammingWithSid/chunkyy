# Chunkyyy vs Chunkx Comparison

This document compares `chunkyyy` (TypeScript) with [`chunkx`](https://github.com/gomantics/chunkx) (Go) to identify feature gaps and capabilities.

## Feature Comparison Matrix

| Feature | Chunkyyy | Chunkx | Notes |
|---------|----------|--------|-------|
| **Core Chunking** |
| AST-based chunking | ✅ | ✅ | Both implement CAST algorithm |
| Semantic chunking | ✅ | ✅ | Functions, classes, methods, etc. |
| Chunk overlapping | ✅ | ✅ | Configurable overlap |
| **Language Support** |
| TypeScript/JavaScript | ✅ | ✅ | Both support TS/JS |
| Multi-language (30+) | ❌ | ✅ | chunkx uses tree-sitter |
| **Chunk Size Configuration** |
| Token-based sizing | ✅ | ✅ | Both support tokens |
| Byte-based sizing | ❌ | ✅ | chunkx supports bytes |
| Line-based sizing | ❌ | ✅ | chunkx supports lines |
| **Token Counting** |
| Simple heuristic | ✅ | ✅ | ~4 chars per token |
| OpenAI tiktoken | ❌ | ✅ | chunkx has tiktoken integration |
| Custom tokenizers | ❌ | ✅ | chunkx supports custom tokenizers |
| **Parser Support** |
| TypeScript Compiler API | ✅ | ❌ | chunkyyy uses TS Compiler API |
| Tree-sitter | ❌ | ✅ | chunkx uses tree-sitter |
| SWC | ⚠️ Planned | ❌ | Not implemented yet |
| Babel | ⚠️ Planned | ❌ | Not implemented yet |
| Esprima | ⚠️ Planned | ❌ | Not implemented yet |
| **Metadata & Analysis** |
| Rich metadata | ✅ | ⚠️ Basic | chunkyyy has extensive metadata |
| Dependency graph | ✅ | ❌ | chunkyyy builds dependency graphs |
| Import/export mapping | ✅ | ❌ | chunkyyy tracks imports/exports |
| Type information | ✅ | ❌ | TypeScript-specific |
| Decorators | ✅ | ❌ | TypeScript-specific |
| JSDoc extraction | ✅ | ❌ | chunkyyy extracts JSDoc |
| **Performance** |
| Incremental updates | ✅ | ❌ | chunkyyy has caching |
| File watching | ✅ | ❌ | chunkyyy supports watch mode |
| **Interfaces** |
| Node.js library | ✅ | ✅ | Both are libraries |
| CLI | ✅ | ❌ | chunkyyy has CLI |
| REST API | ✅ | ❌ | chunkyyy has REST API |
| **Language** |
| TypeScript/Node.js | ✅ | ❌ | chunkyyy is TS/Node |
| Go | ❌ | ✅ | chunkx is Go |

## Key Differences

### Chunkyyy Strengths
1. **Rich Metadata**: Extracts detailed information about code structure (parameters, return types, decorators, JSDoc)
2. **Dependency Analysis**: Builds dependency graphs and import/export maps
3. **Multiple Interfaces**: Provides CLI, library, and REST API
4. **TypeScript-First**: Deep integration with TypeScript features
5. **Incremental Updates**: Caching and file watching for efficient re-chunking

### Chunkx Strengths
1. **Multi-Language**: Supports 30+ languages via tree-sitter
2. **Flexible Sizing**: Supports tokens, bytes, and lines
3. **Better Token Counting**: Integration with OpenAI tiktoken
4. **Go Performance**: Native Go performance benefits

## Missing Features in Chunkyyy

### High Priority
1. **Multi-Language Support**
   - Integrate tree-sitter or similar parser
   - Support Python, Java, Go, Rust, etc.

2. **Multiple Size Units**
   - Add byte-based chunk sizing
   - Add line-based chunk sizing
   - Make size unit configurable

3. **Better Token Counting**
   - Integrate OpenAI tiktoken
   - Support custom tokenizers
   - More accurate token estimation

### Medium Priority
1. **Additional Parsers**
   - Implement SWC adapter
   - Implement Babel adapter
   - Implement Esprima adapter

2. **Performance Optimizations**
   - Parallel processing
   - Better caching strategies

## Recommendations

### To Match Chunkx Capabilities

1. **Add Tree-Sitter Support**
   ```typescript
   // Install tree-sitter bindings
   npm install tree-sitter tree-sitter-typescript tree-sitter-javascript
   // Add more languages as needed
   ```

2. **Add Multiple Size Units**
   ```typescript
   interface ChunkingOptions {
     chunkSize?: number;
     sizeUnit?: 'tokens' | 'bytes' | 'lines'; // New option
   }
   ```

3. **Integrate tiktoken**
   ```typescript
   npm install js-tiktoken
   // Use for accurate token counting
   ```

### To Enhance Beyond Chunkx

1. **Keep Rich Metadata**: This is a key differentiator
2. **Enhance Dependency Analysis**: Add more sophisticated dependency tracking
3. **Add More Extractors**: Support more semantic units (modules, namespaces, etc.)

## Conclusion

**Chunkyyy** is more feature-rich for TypeScript/JavaScript projects with its detailed metadata and dependency analysis, but lacks multi-language support and flexible sizing options that **chunkx** provides.

**Chunkx** excels at multi-language support and flexible configuration, but is more basic in terms of metadata extraction.

The choice depends on:
- **Use chunkyyy** if: You work primarily with TypeScript/JavaScript and need rich metadata
- **Use chunkx** if: You need multi-language support or prefer Go

**Ideal**: Enhance chunkyyy with tree-sitter support and multiple size units to combine the best of both worlds.
