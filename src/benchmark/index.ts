import * as fs from 'fs';
import * as path from 'path';
import { Chunkyyy } from '../chunkyyy';

/**
 * Benchmark chunking quality and performance
 */

interface BenchmarkResult {
  filePath: string;
  chunkCount: number;
  averageChunkSize: number;
  totalTokens: number;
  chunksByType: Record<string, number>;
  timeMs: number;
  errors: string[];
}

async function benchmarkFile(filePath: string): Promise<BenchmarkResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    const chunkyyy = new Chunkyyy({ parser: 'typescript' });
    const chunks = await chunkyyy.chunkFile(filePath);

    const chunksByType: Record<string, number> = {};
    let totalTokens = 0;

    for (const chunk of chunks) {
      chunksByType[chunk.type] = (chunksByType[chunk.type] || 0) + 1;
      totalTokens += chunk.tokenCount || 0;
    }

    const timeMs = Date.now() - startTime;

    return {
      filePath,
      chunkCount: chunks.length,
      averageChunkSize: chunks.length > 0 ? totalTokens / chunks.length : 0,
      totalTokens,
      chunksByType,
      timeMs,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    return {
      filePath,
      chunkCount: 0,
      averageChunkSize: 0,
      totalTokens: 0,
      chunksByType: {},
      timeMs: Date.now() - startTime,
      errors,
    };
  }
}

async function benchmarkDirectory(dirPath: string): Promise<BenchmarkResult[]> {
  const files = fs
    .readdirSync(dirPath, { recursive: true })
    .filter((f): f is string => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx')))
    .map((f: string) => path.join(dirPath, f));

  const results: BenchmarkResult[] = [];

  for (const file of files) {
    const result = await benchmarkFile(file);
    results.push(result);
    console.log(`✓ ${file}: ${result.chunkCount} chunks in ${result.timeMs}ms`);
  }

  return results;
}

function printSummary(results: BenchmarkResult[]) {
  const totalChunks = results.reduce((sum, r) => sum + r.chunkCount, 0);
  const totalTime = results.reduce((sum, r) => sum + r.timeMs, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log('\n=== Benchmark Summary ===');
  console.log(`Total files: ${results.length}`);
  console.log(`Total chunks: ${totalChunks}`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Average chunks per file: ${(totalChunks / results.length).toFixed(2)}`);
  console.log(`Average time per file: ${(totalTime / results.length).toFixed(2)}ms`);
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Errors: ${totalErrors}`);

  // Chunks by type
  const chunksByType: Record<string, number> = {};
  for (const result of results) {
    for (const [type, count] of Object.entries(result.chunksByType)) {
      chunksByType[type] = (chunksByType[type] || 0) + count;
    }
  }

  console.log('\n=== Chunks by Type ===');
  for (const [type, count] of Object.entries(chunksByType)) {
    console.log(`${type}: ${count}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || process.cwd();

  console.log(`Benchmarking: ${target}\n`);

  const stats = fs.statSync(target);
  let results: BenchmarkResult[];

  if (stats.isDirectory()) {
    results = await benchmarkDirectory(target);
  } else {
    results = [await benchmarkFile(target)];
  }

  printSummary(results);
}

if (require.main === module) {
  main().catch(console.error);
}
