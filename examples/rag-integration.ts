/**
 * Example: Integrating Chunkyyy with a RAG pipeline
 * This shows how to chunk code, generate embeddings, and use for retrieval
 */

import { Chunkyyy } from '../src/chunkyyy';
import { Chunk } from '../src/types';

// Mock embedding service (replace with real implementation)
async function generateEmbedding(text: string): Promise<number[]> {
  // In production, use OpenAI, Cohere, or other embedding service
  // This is a mock that returns a random vector
  return Array.from({ length: 1536 }, () => Math.random());
}

// Mock vector database (replace with Pinecone, Weaviate, etc.)
class MockVectorDB {
  private vectors: Map<string, { embedding: number[]; metadata: Chunk }> = new Map();

  async upsert(id: string, embedding: number[], metadata: Chunk) {
    this.vectors.set(id, { embedding, metadata });
  }

  async query(embedding: number[], topK: number = 5): Promise<Array<{ id: string; score: number; metadata: Chunk }>> {
    // Simple cosine similarity (in production, use proper vector DB)
    const results: Array<{ id: string; score: number; metadata: Chunk }> = [];

    this.vectors.forEach((value, id) => {
      const score = cosineSimilarity(embedding, value.embedding);
      results.push({ id, score, metadata: value.metadata });
    });

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function buildRAGPipeline(codebasePath: string) {
  console.log('🚀 Building RAG Pipeline...\n');

  // Step 1: Initialize Chunkyyy
  const chunkyyy = new Chunkyyy({
    parser: 'typescript',
    chunkSize: 512,
  });

  // Step 2: Chunk the codebase
  console.log('📦 Chunking codebase...');
  const result = await chunkyyy.chunkDirectory(codebasePath, { recursive: true });
  console.log(`   ✓ Processed ${result.stats.totalFiles} files`);
  console.log(`   ✓ Extracted ${result.stats.totalChunks} chunks\n`);

  // Step 3: Generate embeddings
  console.log('🔢 Generating embeddings...');
  const vectorDB = new MockVectorDB();

  for (const chunk of result.chunks) {
    const embedding = await generateEmbedding(chunk.content);
    await vectorDB.upsert(chunk.id, embedding, chunk);
  }
  console.log(`   ✓ Generated ${result.chunks.length} embeddings\n`);

  // Step 4: Create search function
  const search = async (query: string, topK: number = 5) => {
    const queryEmbedding = await generateEmbedding(query);
    const results = await vectorDB.query(queryEmbedding, topK);
    return results;
  };

  console.log('✅ RAG Pipeline ready!\n');
  return { search, chunks: result.chunks, stats: result.stats };
}

async function main() {
  // Example: Build RAG pipeline for a codebase
  const { search } = await buildRAGPipeline('./src');

  // Example queries
  const queries = [
    'function that processes user data',
    'class that handles authentication',
    'utility function for formatting dates',
  ];

  console.log('🔍 Testing search queries:\n');

  for (const query of queries) {
    console.log(`Query: "${query}"`);
    const results = await search(query, 3);

    results.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.metadata.qualifiedName} (score: ${result.score.toFixed(3)})`);
      console.log(`     ${result.metadata.filePath}:${result.metadata.startLine}`);
      console.log(`     Type: ${result.metadata.type}`);
    });
    console.log();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { buildRAGPipeline };
