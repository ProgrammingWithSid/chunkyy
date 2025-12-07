/**
 * Basic usage example for Chunkyyy
 */

import { Chunkyyy } from '../src/chunkyyy';

async function main() {
  // Create Chunkyyy instance
  const chunkyyy = new Chunkyyy({
    parser: 'typescript',
    chunkSize: 512,
  });

  // Example 1: Chunk code from string
  const code = `
    import { Component } from '@angular/core';

    @Component({
      selector: 'app-root',
      template: '<h1>Hello</h1>'
    })
    export class AppComponent {
      title = 'My App';

      onClick() {
        console.log('Clicked!');
      }
    }
  `;

  console.log('Example 1: Chunking code from string');
  const chunks = chunkyyy.chunkCode(code, 'app.component.ts');
  console.log(`Found ${chunks.length} chunks:`);

  for (const chunk of chunks) {
    console.log(`  - ${chunk.type}: ${chunk.qualifiedName} (lines ${chunk.startLine}-${chunk.endLine})`);
    if (chunk.exported) {
      console.log(`    Exported: ${chunk.exportName || chunk.name}`);
    }
    if (chunk.decorators.length > 0) {
      console.log(`    Decorators: ${chunk.decorators.join(', ')}`);
    }
  }

  // Example 2: Chunk a file (if it exists)
  try {
    const fileChunks = await chunkyyy.chunkFile('src/chunkyyy.ts');
    console.log(`\nExample 2: Chunked file has ${fileChunks.length} chunks`);
  } catch (error) {
    console.log('\nExample 2: File not found (this is okay for demo)');
  }

  // Example 3: Chunk a directory
  try {
    const result = await chunkyyy.chunkDirectory('src/', { recursive: true });
    console.log(`\nExample 3: Chunked directory:`);
    console.log(`  Files: ${result.stats.totalFiles}`);
    console.log(`  Chunks: ${result.stats.totalChunks}`);
    console.log(`  Average size: ${result.stats.averageChunkSize.toFixed(2)} tokens`);
    console.log(`\nChunks by type:`);
    for (const [type, count] of Object.entries(result.stats.chunksByType)) {
      if (count > 0) {
        console.log(`  ${type}: ${count}`);
      }
    }

    // Example 4: Access dependency graph
    const graph = result.dependencyGraph;
    console.log(`\nExample 4: Dependency graph has ${Object.keys(graph).length} nodes`);
    const sampleEntries = Object.entries(graph).slice(0, 5);
    if (sampleEntries.length > 0) {
      for (const [chunkId, deps] of sampleEntries) {
        const chunk = result.chunks.find(c => c.id === chunkId);
        console.log(`  ${chunk?.name || chunkId} depends on ${deps.length} chunks`);
      }
    }
  } catch (error) {
    console.log('\nExample 3 & 4: Directory not found (this is okay for demo)');
  }
}

main().catch(console.error);
