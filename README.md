# Chunkyyy - AST-Based Semantic Code Chunking Engine

A TypeScript/JavaScript semantic code chunking engine inspired by CAST (Chunking via Abstract Syntax Trees). Optimized for RAG pipelines and code search.

## Features

- 🔍 **AST-Based Chunking**: Uses TypeScript Compiler API, SWC, Babel, or Esprima
- 📦 **Semantic Units**: Extracts functions, classes, methods, interfaces, enums, exports
- 🏷️ **Rich Metadata**: Name, type, line ranges, hash, dependencies
- 🚀 **RAG Optimized**: Designed for retrieval-augmented generation pipelines
- 🔄 **Incremental Updates**: Only re-chunk changed files
- 📚 **Multiple Interfaces**: CLI, Node.js library, and REST API
- 🔒 **Privacy First**: Processes code in-memory, never stores user code

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
├──────────────┬──────────────┬───────────────────────────┤
│     CLI      │   Library    │        REST API           │
└──────┬───────┴──────┬───────┴──────────────┬────────────┘
       │              │                      │
       └──────────────┼──────────────────────┘
                      │
       ┌──────────────▼──────────────────────┐
       │      Chunking Service               │
       │  - File watcher (incremental)       │
       │  - Chunk cache                      │
       │  - Dependency resolver              │
       └──────────────┬──────────────────────┘
                      │
       ┌──────────────▼──────────────────────┐
       │      Chunk Extractor                 │
       │  - AST Parser abstraction            │
       │  - Chunk boundary detection          │
       │  - Metadata generation               │
       └──────────────┬──────────────────────┘
                      │
       ┌──────────────▼──────────────────────┐
       │      AST Parser Adapters            │
       │  - TypeScript Compiler API          │
       │  - SWC                              │
       │  - Babel                            │
       │  - Esprima                          │
       └─────────────────────────────────────┘
```

## Quick Start

### Library Usage

```typescript
import { Chunkyyy } from 'chunkyyy';

const chunkyyy = new Chunkyyy({
  parser: 'typescript', // or 'swc', 'babel', 'esprima'
  chunkSize: 512, // tokens
  overlap: 50, // tokens
});

const chunks = await chunkyyy.chunkFile('src/utils.ts');
console.log(chunks);
```

### CLI Usage

```bash
chunkyyy chunk src/**/*.ts --output chunks.json
chunkyyy watch src/ --output-dir chunks/
```

### API Usage

```bash
curl -X POST http://localhost:3000/api/chunk \
  -H "Content-Type: application/json" \
  -d '{"code": "export function hello() { return 42; }", "path": "test.ts"}'
```

## Installation

```bash
npm install chunkyyy
```

## Documentation

- 📖 **[Getting Started](./GETTING_STARTED.md)** - Quick start guide with examples
- 🔧 **[Usage Guide](./USAGE.md)** - Comprehensive API documentation

## Examples

See [examples/](./examples/) directory for:
- `basic-usage.ts` - Simple usage examples
- `rag-integration.ts` - RAG pipeline integration
- `code-analysis.ts` - Code analysis and metrics
