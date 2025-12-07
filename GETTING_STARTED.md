# Getting Started with Chunkyyy

## What is Chunkyyy?

Chunkyyy is an **AST-based semantic code chunking engine** that breaks your TypeScript/JavaScript code into meaningful pieces (functions, classes, methods, etc.) optimized for:

- 🤖 **AI Code Assistants** - RAG pipelines for code generation
- 🔍 **Code Search** - Semantic search across your codebase
- 📚 **Documentation** - Auto-generate API docs
- 📊 **Code Analysis** - Understand dependencies and structure
- 🛠️ **Developer Tools** - Build IDE plugins, code review tools

## Quick Install

```bash
npm install chunkyyy
npm install -D typescript  # Required for TypeScript parsing
```

## 3-Minute Quick Start

### 1. Basic Usage

```typescript
import { Chunkyyy } from 'chunkyyy';

// Initialize
const chunkyyy = new Chunkyyy();

// Chunk a file
const chunks = await chunkyyy.chunkFile('src/utils.ts');

// Each chunk has rich metadata
chunks.forEach(chunk => {
  console.log(`${chunk.name} (${chunk.type})`);
  console.log(`  Lines: ${chunk.startLine}-${chunk.endLine}`);
  console.log(`  Exported: ${chunk.exported}`);
  console.log(`  Content: ${chunk.content.substring(0, 50)}...`);
});
```

### 2. Chunk Your Entire Codebase

```typescript
const result = await chunkyyy.chunkDirectory('src/', { recursive: true });

console.log(`Processed ${result.stats.totalFiles} files`);
console.log(`Found ${result.stats.totalChunks} chunks`);

// Access all chunks
result.chunks.forEach(chunk => {
  console.log(`${chunk.filePath}: ${chunk.qualifiedName}`);
});
```

### 3. Build a Simple Code Search

```typescript
// Chunk codebase
const result = await chunkyyy.chunkDirectory('./src');

// Filter chunks (example: find all exported functions)
const exportedFunctions = result.chunks.filter(
  c => c.type === 'function' && c.exported
);

// Search by name
const searchResults = exportedFunctions.filter(f =>
  f.name.toLowerCase().includes('user')
);
```

## Common Use Cases

### Use Case 1: AI Code Assistant (RAG)

```typescript
// 1. Chunk your codebase
const result = await chunkyyy.chunkDirectory('./src');

// 2. Generate embeddings (use OpenAI, Cohere, etc.)
const embeddings = await generateEmbeddings(result.chunks);

// 3. Store in vector database (Pinecone, Weaviate, etc.)
await storeInVectorDB(result.chunks, embeddings);

// 4. Retrieve relevant chunks when user asks questions
const relevantChunks = await searchVectorDB(userQuery);
```

### Use Case 2: Generate Documentation

```typescript
const result = await chunkyyy.chunkDirectory('./src');

// Get all exported items
const exported = result.chunks.filter(c => c.exported);

// Generate markdown docs
exported.forEach(chunk => {
  console.log(`## ${chunk.name}`);
  console.log(`Type: ${chunk.type}`);
  if (chunk.jsdoc) console.log(chunk.jsdoc);
  console.log(`\`\`\`typescript\n${chunk.content}\n\`\`\``);
});
```

### Use Case 3: Analyze Dependencies

```typescript
const result = await chunkyyy.chunkDirectory('./src');

// Count most used dependencies
const deps = new Map<string, number>();
result.chunks.forEach(chunk => {
  chunk.dependencies.forEach(dep => {
    deps.set(dep.source, (deps.get(dep.source) || 0) + 1);
  });
});

// Show top dependencies
Array.from(deps.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([source, count]) => {
    console.log(`${source}: ${count} usages`);
  });
```

## What You Get from Each Chunk

```typescript
{
  id: "abc123...",              // Stable unique ID
  name: "calculateTotal",       // Function/class name
  qualifiedName: "Utils.calculateTotal", // Full qualified name
  type: "function",             // function, class, method, etc.
  filePath: "src/utils.ts",     // Source file
  startLine: 10,                // Start line (1-indexed)
  endLine: 25,                  // End line
  content: "function...",       // Actual code
  exported: true,                // Is it exported?
  dependencies: [...],          // What it imports
  parameters: [...],            // Function parameters
  returnType: "number",         // Return type
  decorators: ["@Injectable"],  // Decorators
  jsdoc: "/** ... */",          // JSDoc comments
  // ... and more
}
```

## Configuration Options

```typescript
const chunkyyy = new Chunkyyy({
  parser: 'typescript',        // 'typescript' | 'swc' | 'babel' | 'esprima'
  chunkSize: 512,              // Max tokens per chunk
  includeNested: true,         // Include nested chunks (methods, etc.)
  mergeSmallChunks: true,      // Merge small chunks together
  rootDir: process.cwd(),      // Project root directory
});
```

## Next Steps

1. **Try the examples**: See `examples/` directory
   - `basic-usage.ts` - Simple examples
   - `rag-integration.ts` - RAG pipeline example
   - `code-analysis.ts` - Code analysis example

2. **Read the docs**:
   - [Practical Guide](./docs/PRACTICAL_GUIDE.md) - Real-world examples
   - [Usage Guide](./docs/USAGE.md) - Comprehensive API docs
   - [Architecture](./docs/ARCHITECTURE.md) - How it works

3. **Integrate**: Add to your project and start chunking!

## CLI Usage

```bash
# Chunk a file
chunkyyy chunk src/utils.ts --output chunks.json

# Chunk a directory
chunkyyy chunk src/ --output-dir chunks/

# Start API server
chunkyyy serve --port 3000
```

## API Usage

```bash
# Start server
npm run api

# Chunk code via API
curl -X POST http://localhost:3000/api/chunk \
  -H "Content-Type: application/json" \
  -d '{"code": "export function test() {}", "path": "test.ts"}'
```

## Need Help?

- Check [Practical Guide](./docs/PRACTICAL_GUIDE.md) for real examples
- See [Usage Guide](./docs/USAGE.md) for detailed API docs
- Look at [examples/](./examples/) for code samples

## Why Chunkyyy?

✅ **Semantic Chunking** - Understands code structure, not just lines
✅ **Rich Metadata** - Dependencies, types, decorators, JSDoc
✅ **Stable IDs** - Same chunk = same ID (great for incremental updates)
✅ **RAG Optimized** - Designed for AI/ML pipelines
✅ **Privacy First** - Processes in-memory, never stores your code
✅ **Multiple Interfaces** - Library, CLI, and REST API

---

**Ready to start?** Run `npm install chunkyyy` and try the examples!
