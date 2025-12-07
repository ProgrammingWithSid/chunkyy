# Architecture Documentation

## Overview

Chunkyyy is an AST-based semantic code chunking engine for TypeScript and JavaScript. It extracts semantically meaningful units (functions, classes, methods, interfaces, enums) from source code and provides them as chunks optimized for RAG pipelines.

## Core Components

### 1. Parser Adapters (`src/parsers/`)

Parser adapters provide a unified interface to different AST parsers:
- **TypeScript Compiler API**: Full TypeScript/JavaScript support
- **SWC**: Fast Rust-based parser (planned)
- **Babel**: JavaScript parser (planned)
- **Esprima**: ECMAScript parser (planned)

Each adapter implements the `ParserAdapter` interface, providing methods to:
- Parse code into AST
- Extract node information (name, range, type)
- Identify semantic units (functions, classes, etc.)
- Extract metadata (decorators, type parameters, JSDoc)

### 2. Chunk Extractors (`src/extractors/`)

Extractors traverse the AST and create chunks for different semantic units:

- **FunctionExtractor**: Extracts function declarations and expressions
- **ClassExtractor**: Extracts class declarations (includes nested methods)
- **MethodExtractor**: Extracts methods from classes
- **InterfaceExtractor**: Extracts interface declarations
- **EnumExtractor**: Extracts enum declarations

All extractors extend `BaseExtractor`, which provides:
- Common chunk creation logic
- Metadata extraction
- Nested chunk handling

### 3. Chunking Service (`src/core/chunker.ts`)

The `Chunker` class orchestrates the chunking process:

1. **Parse**: Uses parser adapter to create AST
2. **Extract**: Applies extractors to find semantic units
3. **Post-process**: Merges small chunks, splits large ones
4. **Build metadata**: Creates dependency graphs and import/export maps

### 4. High-Level API (`src/chunkyyy.ts`)

The `Chunkyyy` class provides a user-friendly interface:
- File and directory chunking
- Caching for incremental updates
- Watch mode for file changes

## Chunk Structure

Each chunk contains:

```typescript
{
  id: string;                    // Stable identifier
  type: ChunkType;               // function, class, method, etc.
  name: string;                  // Name of the chunk
  qualifiedName: string;         // Full qualified name (e.g., "MyClass.myMethod")
  filePath: string;              // Source file path
  range: Range;                  // Start/end positions
  startLine: number;             // Start line (1-indexed)
  endLine: number;               // End line (1-indexed)
  hash: string;                  // Content hash for change detection
  dependencies: Dependency[];    // Imported symbols
  parentId?: string;             // Parent chunk ID (if nested)
  childrenIds: string[];         // Child chunk IDs
  exported: boolean;             // Whether exported
  exportName?: string;           // Export name
  visibility?: string;           // public, private, protected
  async?: boolean;               // Whether async
  generator?: boolean;           // Whether generator
  decorators: string[];          // Applied decorators
  typeParameters: string[];       // Generic type parameters
  parameters: Parameter[];        // Function parameters
  returnType?: string;           // Return type
  jsdoc?: string;                // JSDoc comment
  tokenCount?: number;            // Approximate token count
  content: string;               // Actual code content
}
```

## Stable Chunk IDs

Chunk IDs are generated using:
```
hash(filePath + type + qualifiedName)
```

This ensures:
- Same chunk always gets same ID
- IDs are deterministic across runs
- Easy to track chunks across file changes

## Dependency Resolution

Dependencies are extracted from:
1. Import statements (`import { X } from 'Y'`)
2. Dynamic imports (`import('module')`)
3. Require statements (`require('module')`)

The dependency graph maps chunk IDs to their dependencies, enabling:
- Impact analysis
- Dependency-aware retrieval
- Code navigation

## Edge Cases Handled

### Nested Functions
- Inner functions are extracted as separate chunks
- Parent-child relationships are tracked

### Arrow Functions
- Arrow functions assigned to variables are extracted
- Inline arrow functions are included in parent chunk

### Decorators
- Decorators are extracted and stored as metadata
- Applied to classes, methods, properties

### Function Overloads
- Multiple signatures are handled
- Implementation function is extracted

### Generics
- Type parameters are extracted
- Stored as metadata for better matching

### Async/Generator Functions
- Marked with `async` or `generator` flags
- Helps with semantic understanding

## Performance Considerations

1. **Caching**: File hashes prevent re-chunking unchanged files
2. **Incremental Updates**: Only changed files are re-processed
3. **Lazy Parsing**: AST is only parsed when needed
4. **Streaming**: Large files can be processed in chunks

## Integration with RAG Pipelines

### Recommended Pipeline

```
Source Code
    ↓
Chunkyyy (AST Chunking)
    ↓
Chunks with Metadata
    ↓
Embedding Model (e.g., OpenAI, Cohere)
    ↓
Vector Embeddings
    ↓
Vector Database (e.g., Pinecone, Weaviate)
    ↓
Retrieval (Semantic Search)
    ↓
RAG Context
```

### Chunk Selection Strategy

1. **Semantic Search**: Use embeddings to find relevant chunks
2. **Dependency Awareness**: Include dependent chunks
3. **Type Filtering**: Filter by chunk type (function, class, etc.)
4. **Metadata Filtering**: Filter by exports, visibility, etc.

### Example Integration

```typescript
import { Chunkyyy } from 'chunkyyy';
import { embedChunks } from './embedding';
import { storeInVectorDB } from './vectordb';

const chunkyyy = new Chunkyyy();
const result = await chunkyyy.chunkDirectory('./src');

// Embed chunks
const embeddings = await embedChunks(result.chunks);

// Store in vector DB
await storeInVectorDB(result.chunks, embeddings);

// Retrieve relevant chunks
const query = "function that processes user data";
const relevantChunks = await searchVectorDB(query);
```

## Testing Strategy

1. **Unit Tests**: Test individual extractors and utilities
2. **Integration Tests**: Test full chunking pipeline
3. **Edge Case Tests**: Test nested functions, decorators, overloads
4. **Performance Tests**: Benchmark chunking speed
5. **Quality Tests**: Verify chunk boundaries and metadata

## Future Enhancements

1. **Multi-language Support**: Extend to other languages
2. **Better Splitting**: AST-aware splitting for large chunks
3. **Incremental Parsing**: Parse only changed sections
4. **Parallel Processing**: Process multiple files concurrently
5. **Custom Extractors**: Allow users to define custom extractors
