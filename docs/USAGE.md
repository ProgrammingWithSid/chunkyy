# Usage Guide

## Installation

```bash
npm install chunkyyy
```

## Library Usage

### Basic Chunking

```typescript
import { Chunkyyy } from 'chunkyyy';

const chunkyyy = new Chunkyyy({
  parser: 'typescript',
  chunkSize: 512,
});

// Chunk a single file
const chunks = await chunkyyy.chunkFile('src/utils.ts');

// Chunk code from string
const code = `
  export function hello(name: string): string {
    return \`Hello, \${name}!\`;
  }
`;
const chunks = chunkyyy.chunkCode(code, 'test.ts');

// Chunk a directory
const result = await chunkyyy.chunkDirectory('src/', { recursive: true });
console.log(result.stats);
```

### Advanced Options

```typescript
const chunkyyy = new Chunkyyy({
  parser: 'typescript',        // Parser: 'typescript' | 'swc' | 'babel' | 'esprima'
  chunkSize: 512,              // Max tokens per chunk
  overlap: 50,                 // Overlap between chunks
  includeNested: true,         // Include nested chunks
  mergeSmallChunks: true,      // Merge small chunks
  minChunkSize: 50,            // Minimum chunk size
  rootDir: process.cwd(),      // Project root
  include: ['**/*.ts'],        // Include patterns
  exclude: ['node_modules/**'], // Exclude patterns
});
```

### Working with Chunks

```typescript
const chunks = await chunkyyy.chunkFile('src/app.ts');

for (const chunk of chunks) {
  console.log(`Chunk: ${chunk.qualifiedName}`);
  console.log(`Type: ${chunk.type}`);
  console.log(`Lines: ${chunk.startLine}-${chunk.endLine}`);
  console.log(`Exported: ${chunk.exported}`);
  console.log(`Dependencies:`, chunk.dependencies);
  console.log(`Content:`, chunk.content);
}
```

### Dependency Graph

```typescript
const result = await chunkyyy.chunkDirectory('src/');

// Access dependency graph
const graph = result.dependencyGraph;
for (const [chunkId, dependencies] of Object.entries(graph)) {
  console.log(`Chunk ${chunkId} depends on:`, dependencies);
}

// Access import/export map
const importExportMap = result.importExportMap;
for (const [filePath, exports] of importExportMap.exports) {
  console.log(`${filePath} exports:`, exports);
}
```

### Caching

```typescript
// Chunkyyy automatically caches chunks
const chunks1 = await chunkyyy.chunkFile('src/utils.ts');
// Second call uses cache (if file unchanged)
const chunks2 = await chunkyyy.chunkFile('src/utils.ts');

// Clear cache
chunkyyy.clearCache('src/utils.ts'); // Clear specific file
chunkyyy.clearCache(); // Clear all
```

## CLI Usage

### Chunk a File

```bash
chunkyyy chunk src/utils.ts --output chunks.json
```

### Chunk a Directory

```bash
chunkyyy chunk src/ --output-dir chunks/
```

### Watch Mode

```bash
chunkyyy watch src/ --output-dir chunks/
```

### Options

```bash
chunkyyy chunk src/ \
  --parser typescript \
  --chunk-size 512 \
  --output chunks.json
```

## API Usage

### Start Server

```bash
chunkyyy serve --port 3000
# or
npm run api
```

### Chunk Code

```bash
curl -X POST http://localhost:3000/api/chunk \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export function hello() { return 42; }",
    "path": "test.ts"
  }'
```

### Chunk File

```bash
curl -X POST http://localhost:3000/api/chunk/file \
  -H "Content-Type: application/json" \
  -d '{
    "path": "src/utils.ts"
  }'
```

### Chunk Directory

```bash
curl -X POST http://localhost:3000/api/chunk/directory \
  -H "Content-Type: application/json" \
  -d '{
    "path": "src/"
  }'
```

## Integration with RAG Pipelines

### Step 1: Chunk Your Codebase

```typescript
import { Chunkyyy } from 'chunkyyy';

const chunkyyy = new Chunkyyy();
const result = await chunkyyy.chunkDirectory('./src');
```

### Step 2: Generate Embeddings

```typescript
import { embedChunks } from './embedding-service';

const embeddings = await embedChunks(
  result.chunks.map(chunk => ({
    id: chunk.id,
    text: chunk.content,
    metadata: {
      type: chunk.type,
      name: chunk.name,
      filePath: chunk.filePath,
      // ... other metadata
    },
  }))
);
```

### Step 3: Store in Vector Database

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('code-chunks');

await index.upsert(
  result.chunks.map((chunk, i) => ({
    id: chunk.id,
    values: embeddings[i],
    metadata: {
      type: chunk.type,
      name: chunk.name,
      qualifiedName: chunk.qualifiedName,
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      exported: chunk.exported,
      dependencies: JSON.stringify(chunk.dependencies),
    },
  }))
);
```

### Step 4: Retrieve Relevant Chunks

```typescript
async function retrieveChunks(query: string, topK: number = 5) {
  const queryEmbedding = await embedQuery(query);

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return results.matches.map(match => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata,
  }));
}
```

### Step 5: Use in RAG

```typescript
async function generateCode(query: string) {
  // Retrieve relevant chunks
  const relevantChunks = await retrieveChunks(query);

  // Build context
  const context = relevantChunks
    .map(chunk => `// ${chunk.metadata.filePath}:${chunk.metadata.startLine}\n${chunk.metadata.content}`)
    .join('\n\n');

  // Generate with LLM
  const prompt = `
Context:
${context}

Query: ${query}

Generate code:
  `;

  return await llm.generate(prompt);
}
```

## Best Practices

### 1. Chunk Size

- **Small chunks (256-512 tokens)**: Better for precise retrieval
- **Large chunks (512-1024 tokens)**: Better for context preservation
- **Balance**: Use 512 tokens as default, adjust based on your codebase

### 2. Parser Selection

- **TypeScript Compiler API**: Best for TypeScript, most accurate
- **SWC**: Fastest, good for large codebases
- **Babel**: Good compatibility, extensible
- **Esprima**: Standard JavaScript only

### 3. Filtering Chunks

```typescript
// Filter by type
const functions = chunks.filter(c => c.type === 'function');

// Filter by export
const exported = chunks.filter(c => c.exported);

// Filter by file pattern
const utils = chunks.filter(c => c.filePath.includes('utils'));

// Filter by dependencies
const usesReact = chunks.filter(c =>
  c.dependencies.some(d => d.source.includes('react'))
);
```

### 4. Dependency-Aware Retrieval

```typescript
function getChunksWithDependencies(chunkId: string, graph: DependencyGraph) {
  const visited = new Set<string>();
  const result: string[] = [];

  function traverse(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    result.push(id);

    const deps = graph[id] || [];
    for (const dep of deps) {
      traverse(dep);
    }
  }

  traverse(chunkId);
  return result;
}
```

### 5. Incremental Updates

```typescript
// Watch for file changes
chunkyyy.watchDirectory('src/', (filePath, chunks) => {
  // Update vector database with new chunks
  updateVectorDB(chunks);
});
```

## Examples

See `examples/` directory for complete examples:
- `basic-usage.ts`: Basic chunking
- `rag-integration.ts`: RAG pipeline integration
- `dependency-analysis.ts`: Dependency graph analysis
- `incremental-updates.ts`: Watch mode usage
