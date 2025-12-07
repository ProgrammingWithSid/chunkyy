# Practical Guide: Using Chunkyyy in Your Project

## What Can You Use Chunkyyy For?

Chunkyyy is perfect for:

1. **RAG (Retrieval-Augmented Generation) Pipelines**
   - Code search and retrieval
   - AI code assistants
   - Documentation generation
   - Code completion systems

2. **Code Analysis & Documentation**
   - Generate API documentation
   - Analyze code structure
   - Track dependencies
   - Code metrics and statistics

3. **Developer Tools**
   - Code search engines
   - IDE plugins
   - Code review tools
   - Refactoring assistants

4. **Knowledge Bases**
   - Build code knowledge graphs
   - Semantic code search
   - Code recommendations
   - Learning systems

## Installation

### Step 1: Install the Package

```bash
npm install chunkyyy
# or
yarn add chunkyyy
# or
pnpm add chunkyyy
```

### Step 2: Install TypeScript (if not already installed)

```bash
npm install -D typescript @types/node
```

## Quick Start Examples

### Example 1: Basic Code Chunking

```typescript
import { Chunkyyy } from 'chunkyyy';

// Initialize
const chunkyyy = new Chunkyyy({
  parser: 'typescript',
});

// Chunk a single file
const chunks = await chunkyyy.chunkFile('src/utils.ts');

// Each chunk contains:
chunks.forEach(chunk => {
  console.log(`Name: ${chunk.name}`);
  console.log(`Type: ${chunk.type}`); // 'function', 'class', 'method', etc.
  console.log(`Lines: ${chunk.startLine}-${chunk.endLine}`);
  console.log(`Exported: ${chunk.exported}`);
  console.log(`Content: ${chunk.content}`);
});
```

### Example 2: Chunk Your Entire Codebase

```typescript
import { Chunkyyy } from 'chunkyyy';

const chunkyyy = new Chunkyyy();

// Chunk entire src directory
const result = await chunkyyy.chunkDirectory('src/', { recursive: true });

console.log(`Processed ${result.stats.totalFiles} files`);
console.log(`Found ${result.stats.totalChunks} chunks`);

// Access all chunks
result.chunks.forEach(chunk => {
  console.log(`${chunk.filePath}: ${chunk.qualifiedName}`);
});
```

### Example 3: Build a Code Search System

```typescript
import { Chunkyyy } from 'chunkyyy';
import { embedChunks, searchSimilar } from './your-embedding-service';

async function buildCodeSearch(codebasePath: string) {
  const chunkyyy = new Chunkyyy();

  // 1. Chunk the codebase
  const result = await chunkyyy.chunkDirectory(codebasePath);

  // 2. Generate embeddings (using OpenAI, Cohere, etc.)
  const embeddings = await embedChunks(
    result.chunks.map(chunk => ({
      id: chunk.id,
      text: chunk.content,
      metadata: {
        name: chunk.name,
        type: chunk.type,
        filePath: chunk.filePath,
        exported: chunk.exported,
      },
    }))
  );

  // 3. Store in vector database (Pinecone, Weaviate, etc.)
  // ... store logic ...

  return {
    search: async (query: string) => {
      // 4. Search for similar chunks
      const results = await searchSimilar(query, embeddings);
      return results.map(r => result.chunks.find(c => c.id === r.id));
    },
  };
}

// Use it
const codeSearch = await buildCodeSearch('./src');
const results = await codeSearch.search('function that validates user input');
```

### Example 4: Generate API Documentation

```typescript
import { Chunkyyy } from 'chunkyyy';
import * as fs from 'fs';

async function generateDocs(codebasePath: string, outputPath: string) {
  const chunkyyy = new Chunkyyy();
  const result = await chunkyyy.chunkDirectory(codebasePath);

  const docs: string[] = [];

  // Group chunks by file
  const chunksByFile = new Map<string, typeof result.chunks>();
  result.chunks.forEach(chunk => {
    if (!chunksByFile.has(chunk.filePath)) {
      chunksByFile.set(chunk.filePath, []);
    }
    chunksByFile.get(chunk.filePath)!.push(chunk);
  });

  // Generate docs
  chunksByFile.forEach((chunks, filePath) => {
    docs.push(`# ${filePath}\n\n`);

    chunks
      .filter(c => c.exported) // Only exported items
      .forEach(chunk => {
        docs.push(`## ${chunk.name}\n\n`);
        docs.push(`**Type:** ${chunk.type}\n\n`);

        if (chunk.jsdoc) {
          docs.push(`${chunk.jsdoc}\n\n`);
        }

        if (chunk.parameters && chunk.parameters.length > 0) {
          docs.push(`**Parameters:**\n`);
          chunk.parameters.forEach(param => {
            docs.push(`- \`${param.name}\`: ${param.type || 'any'}\n`);
          });
          docs.push(`\n`);
        }

        if (chunk.returnType) {
          docs.push(`**Returns:** \`${chunk.returnType}\`\n\n`);
        }

        docs.push(`\`\`\`typescript\n${chunk.content}\n\`\`\`\n\n`);
      });
  });

  fs.writeFileSync(outputPath, docs.join(''));
}

generateDocs('./src', './docs/api.md');
```

### Example 5: Analyze Dependencies

```typescript
import { Chunkyyy } from 'chunkyyy';

async function analyzeDependencies(codebasePath: string) {
  const chunkyyy = new Chunkyyy();
  const result = await chunkyyy.chunkDirectory(codebasePath);

  // Build dependency report
  const report = {
    totalChunks: result.chunks.length,
    dependencies: new Map<string, number>(),
    mostUsed: [] as Array<{ name: string; count: number }>,
  };

  // Count dependencies
  result.chunks.forEach(chunk => {
    chunk.dependencies.forEach(dep => {
      const count = report.dependencies.get(dep.source) || 0;
      report.dependencies.set(dep.source, count + 1);
    });
  });

  // Find most used dependencies
  report.mostUsed = Array.from(report.dependencies.entries())
    .map(([source, count]) => ({ name: source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  console.log('Dependency Analysis:');
  console.log(`Total chunks: ${report.totalChunks}`);
  console.log('\nMost used dependencies:');
  report.mostUsed.forEach(({ name, count }) => {
    console.log(`  ${name}: used in ${count} chunks`);
  });

  return report;
}
```

### Example 6: Find All Exported Functions

```typescript
import { Chunkyyy } from 'chunkyyy';

async function findExportedFunctions(codebasePath: string) {
  const chunkyyy = new Chunkyyy();
  const result = await chunkyyy.chunkDirectory(codebasePath);

  const exportedFunctions = result.chunks.filter(
    chunk => chunk.type === 'function' && chunk.exported
  );

  console.log(`Found ${exportedFunctions.length} exported functions:`);
  exportedFunctions.forEach(func => {
    console.log(`  - ${func.qualifiedName} (${func.filePath})`);
    if (func.parameters.length > 0) {
      const params = func.parameters.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
      console.log(`    Parameters: ${params}`);
    }
  });

  return exportedFunctions;
}
```

### Example 7: Build a Code Completion System

```typescript
import { Chunkyyy } from 'chunkyyy';

class CodeCompletionSystem {
  private chunks: Map<string, any>;
  private chunkyyy: Chunkyyy;

  constructor() {
    this.chunks = new Map();
    this.chunkyyy = new Chunkyyy();
  }

  async indexCodebase(path: string) {
    const result = await this.chunkyyy.chunkDirectory(path);

    // Index chunks by name and type
    result.chunks.forEach(chunk => {
      const key = `${chunk.type}:${chunk.name}`;
      if (!this.chunks.has(key)) {
        this.chunks.set(key, []);
      }
      this.chunks.get(key)!.push(chunk);
    });
  }

  getCompletions(prefix: string, type?: string) {
    const matches: any[] = [];

    this.chunks.forEach((chunks, key) => {
      const [chunkType, name] = key.split(':');

      if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
        if (!type || chunkType === type) {
          matches.push(...chunks);
        }
      }
    });

    return matches.slice(0, 10); // Top 10 matches
  }
}

// Use it
const completion = new CodeCompletionSystem();
await completion.indexCodebase('./src');

// Get completions
const completions = completion.getCompletions('get', 'function');
completions.forEach(c => {
  console.log(`${c.qualifiedName} - ${c.filePath}`);
});
```

### Example 8: Track Code Changes

```typescript
import { Chunkyyy } from 'chunkyyy';

async function trackChanges(filePath: string) {
  const chunkyyy = new Chunkyyy();

  // First chunking
  const chunks1 = await chunkyyy.chunkFile(filePath);
  const chunks1Map = new Map(chunks1.map(c => [c.id, c]));

  // ... code changes ...

  // Clear cache and re-chunk
  chunkyyy.clearCache(filePath);
  const chunks2 = await chunkyyy.chunkFile(filePath);
  const chunks2Map = new Map(chunks2.map(c => [c.id, c]));

  // Find changed chunks
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  chunks1Map.forEach((chunk, id) => {
    const newChunk = chunks2Map.get(id);
    if (!newChunk) {
      removed.push(id);
    } else if (chunk.hash !== newChunk.hash) {
      changed.push(id);
    }
  });

  chunks2Map.forEach((chunk, id) => {
    if (!chunks1Map.has(id)) {
      added.push(id);
    }
  });

  console.log(`Changed: ${changed.length}`);
  console.log(`Added: ${added.length}`);
  console.log(`Removed: ${removed.length}`);
}
```

## Common Use Cases

### 1. AI Code Assistant

```typescript
// Chunk codebase → Embed → Store in vector DB → Retrieve on query
const chunks = await chunkyyy.chunkDirectory('./src');
// Then use with OpenAI, Anthropic, etc. for code generation
```

### 2. Code Search

```typescript
// Index codebase → Search by semantic similarity
const result = await chunkyyy.chunkDirectory('./src');
// Use embeddings to find similar code
```

### 3. Documentation Generator

```typescript
// Extract exported functions/classes → Generate docs
const chunks = result.chunks.filter(c => c.exported);
// Generate markdown/HTML docs
```

### 4. Dependency Analyzer

```typescript
// Analyze imports/exports → Build dependency graph
const graph = result.dependencyGraph;
// Visualize or analyze dependencies
```

### 5. Code Metrics

```typescript
// Count functions, classes, etc. → Generate metrics
const stats = result.stats;
// Use for code quality analysis
```

## Integration with Popular Tools

### With OpenAI Embeddings

```typescript
import { Chunkyyy } from 'chunkyyy';
import OpenAI from 'openai';

const openai = new OpenAI();
const chunkyyy = new Chunkyyy();

const result = await chunkyyy.chunkDirectory('./src');

// Generate embeddings
const embeddings = await Promise.all(
  result.chunks.map(async chunk => ({
    id: chunk.id,
    embedding: await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk.content,
    }),
    metadata: chunk,
  }))
);
```

### With Pinecone Vector Database

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { Chunkyyy } from 'chunkyyy';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('code-chunks');
const chunkyyy = new Chunkyyy();

const result = await chunkyyy.chunkDirectory('./src');

// Store chunks
await index.upsert(
  result.chunks.map(chunk => ({
    id: chunk.id,
    values: await getEmbedding(chunk.content),
    metadata: {
      name: chunk.name,
      type: chunk.type,
      filePath: chunk.filePath,
      // ... other metadata
    },
  }))
);
```

### With LangChain

```typescript
import { Chunkyyy } from 'chunkyyy';
import { Document } from 'langchain/document';

const chunkyyy = new Chunkyyy();
const result = await chunkyyy.chunkDirectory('./src');

// Convert to LangChain documents
const documents = result.chunks.map(chunk =>
  new Document({
    pageContent: chunk.content,
    metadata: {
      id: chunk.id,
      name: chunk.name,
      type: chunk.type,
      filePath: chunk.filePath,
    },
  })
);

// Use with LangChain vector stores
```

## Tips & Best Practices

1. **Start Small**: Begin with a single file or small directory
2. **Use Caching**: Chunkyyy caches automatically - don't clear unless needed
3. **Filter Chunks**: Filter by type, export status, etc. for your use case
4. **Handle Errors**: Wrap in try-catch for production code
5. **Optimize Chunk Size**: Adjust `chunkSize` based on your embedding model
6. **Use Metadata**: Leverage rich metadata for better search/filtering

## Troubleshooting

**Issue**: "Parser not found"
- **Solution**: Make sure TypeScript is installed: `npm install -D typescript`

**Issue**: "File not found"
- **Solution**: Use absolute paths or set `rootDir` option

**Issue**: "Too many chunks"
- **Solution**: Increase `chunkSize` or enable `mergeSmallChunks`

**Issue**: "Missing nested chunks"
- **Solution**: Set `includeNested: true` (default)

## Next Steps

1. Try the examples above
2. Integrate with your embedding service
3. Store in your vector database
4. Build your RAG pipeline
5. Customize chunking options for your needs

For more details, see:
- [Usage Guide](./USAGE.md)
- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API.md) (if available)
