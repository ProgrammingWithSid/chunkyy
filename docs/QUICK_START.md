# Quick Start Guide

## Project Overview

**Chunkyyy** is an AST-based semantic code chunking engine for TypeScript and JavaScript, inspired by the CAST (Chunking via Abstract Syntax Trees) research paper. It extracts semantically meaningful units from source code optimized for RAG (Retrieval-Augmented Generation) pipelines.

## Key Features

✅ **AST-Based Chunking**: Uses TypeScript Compiler API, SWC, Babel, or Esprima
✅ **Semantic Units**: Extracts functions, classes, methods, interfaces, enums, exports
✅ **Rich Metadata**: Name, type, line ranges, hash, dependencies, decorators, JSDoc
✅ **Stable IDs**: Deterministic chunk IDs for incremental updates
✅ **Dependency Graph**: Tracks imports/exports and dependencies
✅ **Multiple Interfaces**: CLI, Node.js library, and REST API
✅ **Privacy First**: Processes code in-memory, never stores user code
✅ **RAG Optimized**: Designed for retrieval-augmented generation

## Installation

```bash
npm install chunkyyy
```

## Quick Examples

### Library Usage

```typescript
import { Chunkyyy } from 'chunkyyy';

const chunkyyy = new Chunkyyy({ parser: 'typescript' });

// Chunk code from string
const chunks = chunkyyy.chunkCode(`
  export function hello(name: string): string {
    return \`Hello, \${name}!\`;
  }
`, 'test.ts');

console.log(chunks[0].name); // "hello"
console.log(chunks[0].type); // "function"
console.log(chunks[0].exported); // true
```

### CLI Usage

```bash
# Chunk a file
chunkyyy chunk src/utils.ts --output chunks.json

# Chunk a directory
chunkyyy chunk src/ --output-dir chunks/

# Start API server
chunkyyy serve --port 3000
```

### API Usage

```bash
# Start server
npm run api

# Chunk code via API
curl -X POST http://localhost:3000/api/chunk \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export function test() { return 42; }",
    "path": "test.ts"
  }'
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Application Layer                │
│  ┌──────┐  ┌────────┐  ┌─────────────┐ │
│  │ CLI  │  │Library │  │  REST API   │ │
│  └──┬───┘  └───┬────┘  └──────┬───────┘ │
│     └──────────┼──────────────┘         │
│                │                         │
│     ┌──────────▼──────────┐             │
│     │  Chunking Service   │             │
│     │  - File watcher     │             │
│     │  - Chunk cache      │             │
│     └──────────┬──────────┘             │
│                │                         │
│     ┌──────────▼──────────┐             │
│     │  Chunk Extractor    │             │
│     │  - AST traversal    │             │
│     │  - Boundary detect  │             │
│     └──────────┬──────────┘             │
│                │                         │
│     ┌──────────▼──────────┐             │
│     │  Parser Adapters    │             │
│     │  - TypeScript API   │             │
│     │  - SWC / Babel      │             │
│     └─────────────────────┘             │
└─────────────────────────────────────────┘
```

## Project Structure

```
chunkyyy/
├── src/
│   ├── core/           # Core chunking logic
│   ├── parsers/        # AST parser adapters
│   ├── extractors/     # Chunk extractors
│   ├── utils/          # Utilities (hash, token count)
│   ├── api/            # REST API server
│   ├── cli/            # CLI interface
│   ├── benchmark/      # Benchmarking utilities
│   └── __tests__/      # Tests
├── docs/               # Documentation
├── examples/           # Usage examples
└── package.json
```

## Core Concepts

### Chunk Structure

Each chunk contains:
- **Identity**: `id`, `name`, `qualifiedName`, `type`
- **Location**: `filePath`, `startLine`, `endLine`, `range`
- **Content**: `content`, `hash`, `tokenCount`
- **Metadata**: `exported`, `dependencies`, `decorators`, `parameters`, `returnType`, `jsdoc`
- **Relationships**: `parentId`, `childrenIds`

### Chunk Types

- `function`: Function declarations
- `class`: Class declarations
- `method`: Class methods
- `interface`: Interface declarations
- `enum`: Enum declarations
- `type-alias`: Type aliases
- `namespace`: Namespaces
- `export`: Export declarations
- `top-level-declaration`: Other top-level declarations

### Stable Chunk IDs

Chunk IDs are generated deterministically:
```
hash(filePath + type + qualifiedName)
```

This ensures:
- Same chunk always gets same ID
- Enables incremental updates
- Works well with vector databases

## Integration with RAG

### Recommended Pipeline

1. **Chunk**: Use Chunkyyy to extract semantic chunks
2. **Embed**: Generate embeddings for chunks
3. **Store**: Store in vector database (Pinecone, Weaviate, etc.)
4. **Retrieve**: Semantic search for relevant chunks
5. **Generate**: Use chunks as context for LLM

### Example Integration

```typescript
import { Chunkyyy } from 'chunkyyy';
import { embedChunks } from './embedding';
import { storeInVectorDB } from './vectordb';

// 1. Chunk codebase
const chunkyyy = new Chunkyyy();
const result = await chunkyyy.chunkDirectory('./src');

// 2. Generate embeddings
const embeddings = await embedChunks(result.chunks);

// 3. Store in vector DB
await storeInVectorDB(result.chunks, embeddings);

// 4. Retrieve relevant chunks
const query = "function that processes user data";
const relevantChunks = await searchVectorDB(query);
```

## Configuration Options

```typescript
const chunkyyy = new Chunkyyy({
  parser: 'typescript',        // Parser: 'typescript' | 'swc' | 'babel' | 'esprima'
  chunkSize: 512,              // Max tokens per chunk
  overlap: 50,                  // Overlap between chunks
  includeNested: true,          // Include nested chunks
  mergeSmallChunks: true,      // Merge small chunks
  minChunkSize: 50,            // Minimum chunk size
  rootDir: process.cwd(),      // Project root
  include: ['**/*.ts'],        // Include patterns
  exclude: ['node_modules/**'], // Exclude patterns
});
```

## Edge Cases Handled

- ✅ Nested functions
- ✅ Arrow functions
- ✅ Decorators
- ✅ Function overloads
- ✅ Generics (type parameters)
- ✅ Async/generator functions
- ✅ Anonymous functions
- ✅ Export variations
- ✅ Namespaces and modules
- ✅ Type aliases and interfaces
- ✅ Enums
- ✅ Class methods and properties
- ✅ JSDoc comments
- ✅ Complex imports/exports
- ✅ Large files
- ✅ Syntax errors

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run benchmarks
npm run benchmark
```

## Documentation

- [Architecture](./ARCHITECTURE.md): Detailed architecture documentation
- [Usage Guide](./USAGE.md): Comprehensive usage examples
- [TypeScript Compiler API](./TS_COMPILER_API.md): How we use TS Compiler API
- [Edge Cases](./EDGE_CASES.md): Edge cases and handling
- [Design Decisions](./DESIGN_DECISIONS.md): Key design decisions

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Lint
npm run lint

# Format
npm run format
```

## Next Steps

1. **Install**: `npm install chunkyyy`
2. **Try Examples**: See `examples/` directory
3. **Read Docs**: Check `docs/` directory
4. **Integrate**: Add to your RAG pipeline
5. **Customize**: Adjust chunking options for your needs

## Support

- Issues: GitHub Issues
- Documentation: `docs/` directory
- Examples: `examples/` directory

## License

MIT
