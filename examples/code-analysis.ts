/**
 * Example: Using Chunkyyy for code analysis
 * Analyze codebase structure, dependencies, and metrics
 */

import { Chunkyyy } from '../src/chunkyyy';

interface CodeMetrics {
  totalFiles: number;
  totalChunks: number;
  chunksByType: Record<string, number>;
  exportedChunks: number;
  averageChunkSize: number;
  mostUsedDependencies: Array<{ source: string; count: number }>;
  filesWithMostChunks: Array<{ filePath: string; count: number }>;
}

async function analyzeCodebase(codebasePath: string): Promise<CodeMetrics> {
  const chunkyyy = new Chunkyyy({
    parser: 'typescript',
  });

  console.log(`📊 Analyzing codebase: ${codebasePath}\n`);

  // Chunk the codebase
  const result = await chunkyyy.chunkDirectory(codebasePath, { recursive: true });

  // Calculate metrics
  const metrics: CodeMetrics = {
    totalFiles: result.stats.totalFiles,
    totalChunks: result.stats.totalChunks,
    chunksByType: result.stats.chunksByType,
    exportedChunks: result.chunks.filter(c => c.exported).length,
    averageChunkSize: result.stats.averageChunkSize,
    mostUsedDependencies: [],
    filesWithMostChunks: [],
  };

  // Analyze dependencies
  const dependencyCounts = new Map<string, number>();
  result.chunks.forEach(chunk => {
    chunk.dependencies.forEach(dep => {
      const count = dependencyCounts.get(dep.source) || 0;
      dependencyCounts.set(dep.source, count + 1);
    });
  });

  metrics.mostUsedDependencies = Array.from(dependencyCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Analyze files
  const fileChunkCounts = new Map<string, number>();
  result.chunks.forEach(chunk => {
    const count = fileChunkCounts.get(chunk.filePath) || 0;
    fileChunkCounts.set(chunk.filePath, count + 1);
  });

  metrics.filesWithMostChunks = Array.from(fileChunkCounts.entries())
    .map(([filePath, count]) => ({ filePath, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return metrics;
}

function printMetrics(metrics: CodeMetrics) {
  console.log('═══════════════════════════════════════');
  console.log('           CODEBASE METRICS');
  console.log('═══════════════════════════════════════\n');

  console.log('📁 Files & Chunks:');
  console.log(`   Total Files: ${metrics.totalFiles}`);
  console.log(`   Total Chunks: ${metrics.totalChunks}`);
  console.log(`   Exported Chunks: ${metrics.exportedChunks}`);
  console.log(`   Average Chunk Size: ${metrics.averageChunkSize.toFixed(2)} tokens\n`);

  console.log('📦 Chunks by Type:');
  Object.entries(metrics.chunksByType)
    .filter(([_, count]) => count > 0)
    .sort(([_, a], [__, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  console.log();

  console.log('🔗 Most Used Dependencies:');
  metrics.mostUsedDependencies.forEach((dep, i) => {
    console.log(`   ${i + 1}. ${dep.source} (used in ${dep.count} chunks)`);
  });
  console.log();

  console.log('📄 Files with Most Chunks:');
  metrics.filesWithMostChunks.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file.filePath} (${file.count} chunks)`);
  });
  console.log();
}

async function findExportedAPI(codebasePath: string) {
  const chunkyyy = new Chunkyyy();
  const result = await chunkyyy.chunkDirectory(codebasePath, { recursive: true });

  const exported = result.chunks.filter(c => c.exported);

  console.log('📤 Exported API:\n');

  const byType = new Map<string, typeof exported>();
  exported.forEach(chunk => {
    if (!byType.has(chunk.type)) {
      byType.set(chunk.type, []);
    }
    byType.get(chunk.type)!.push(chunk);
  });

  byType.forEach((chunks, type) => {
    console.log(`${type.toUpperCase()} (${chunks.length}):`);
    chunks.forEach(chunk => {
      console.log(`  - ${chunk.qualifiedName}`);
      if (chunk.parameters && chunk.parameters.length > 0) {
        const params = chunk.parameters.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
        console.log(`    (${params})`);
      }
    });
    console.log();
  });
}

async function analyzeDependencies(codebasePath: string) {
  const chunkyyy = new Chunkyyy();
  const result = await chunkyyy.chunkDirectory(codebasePath, { recursive: true });

  console.log('🔍 Dependency Analysis:\n');

  // Build dependency graph
  const graph = result.dependencyGraph;
  const chunksWithDeps = Object.entries(graph).filter(([_, deps]) => deps.length > 0);

  console.log(`Chunks with dependencies: ${chunksWithDeps.length}\n`);

  // Find chunks with most dependencies
  const topDependents = chunksWithDeps
    .map(([id, deps]) => ({
      chunk: result.chunks.find(c => c.id === id)!,
      depCount: deps.length,
    }))
    .sort((a, b) => b.depCount - a.depCount)
    .slice(0, 10);

  console.log('Top 10 chunks by dependencies:');
  topDependents.forEach(({ chunk, depCount }, i) => {
    console.log(`  ${i + 1}. ${chunk.qualifiedName} (${depCount} dependencies)`);
    console.log(`     ${chunk.filePath}:${chunk.startLine}`);
  });
}

async function main() {
  const codebasePath = './src';

  try {
    // Analyze codebase
    const metrics = await analyzeCodebase(codebasePath);
    printMetrics(metrics);

    // Find exported API
    console.log('\n═══════════════════════════════════════\n');
    await findExportedAPI(codebasePath);

    // Analyze dependencies
    console.log('\n═══════════════════════════════════════\n');
    await analyzeDependencies(codebasePath);
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  main();
}
