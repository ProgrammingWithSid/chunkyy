# Design Decisions

This document explains key design decisions made in Chunkyyy.

## Architecture Decisions

### 1. Parser Adapter Pattern

**Decision**: Use an adapter pattern to abstract over different parsers.

**Rationale**:
- Allows switching parsers without changing core logic
- Enables parser-specific optimizations
- Makes testing easier (can mock adapters)
- Supports multiple parsers for different use cases

**Trade-offs**:
- Additional abstraction layer
- Some parser-specific features may be lost

### 2. Extractor-Based Chunking

**Decision**: Use separate extractors for each chunk type.

**Rationale**:
- Single Responsibility Principle
- Easy to add new chunk types
- Each extractor can have specialized logic
- Testable in isolation

**Trade-offs**:
- More classes/files to maintain
- Potential duplication of common logic

### 3. In-Memory Processing Only

**Decision**: Never store user code, only process in memory.

**Rationale**:
- Privacy/security: user code never persisted
- Simpler architecture
- Faster processing (no I/O)
- Easier to integrate into existing pipelines

**Trade-offs**:
- Cannot resume interrupted processing
- Memory usage for large codebases

### 4. Stable Chunk IDs

**Decision**: Generate IDs based on file path + qualified name + type.

**Rationale**:
- Deterministic: same chunk always gets same ID
- Enables incremental updates
- Easy to track chunks across changes
- Works well with vector databases

**Trade-offs**:
- IDs change if qualified name changes
- Requires careful handling of renames

### 5. Metadata-Rich Chunks

**Decision**: Include extensive metadata in each chunk.

**Rationale**:
- Enables better retrieval
- Supports filtering and search
- Helps with RAG context building
- Useful for code analysis

**Trade-offs**:
- Larger chunk objects
- More processing time

## Chunking Strategy

### 1. AST-Based Boundaries

**Decision**: Use AST nodes to define chunk boundaries.

**Rationale**:
- Preserves semantic structure
- Better than line-based chunking
- Aligns with CAST paper findings
- More accurate for code understanding

**Trade-offs**:
- More complex than line-based
- Requires AST parsing overhead

### 2. Size Limits with Merging

**Decision**: Merge small chunks, split large ones.

**Rationale**:
- Balances chunk size for RAG
- Prevents too many tiny chunks
- Handles large functions/classes
- Configurable thresholds

**Trade-offs**:
- May merge unrelated code
- Splitting large chunks is complex

### 3. Nested Chunk Handling

**Decision**: Extract nested chunks (e.g., methods from classes).

**Rationale**:
- Methods are often retrieved independently
- Better granularity for retrieval
- Preserves parent-child relationships
- More accurate semantic units

**Trade-offs**:
- More chunks to manage
- Potential context loss

## API Design

### 1. Multiple Interfaces (CLI, Library, API)

**Decision**: Provide CLI, library, and REST API.

**Rationale**:
- Different use cases need different interfaces
- CLI for one-off tasks
- Library for programmatic use
- API for remote access

**Trade-offs**:
- More code to maintain
- Need to keep interfaces consistent

### 2. Caching Strategy

**Decision**: Cache chunks based on file hash.

**Rationale**:
- Enables incremental updates
- Faster repeated processing
- Reduces unnecessary work

**Trade-offs**:
- Memory usage
- Cache invalidation complexity

### 3. Error Handling

**Decision**: Continue processing on errors, log and return partial results.

**Rationale**:
- More resilient
- Don't fail entire batch on one error
- User can see what succeeded

**Trade-offs**:
- May hide important errors
- Partial results may be confusing

## Performance Considerations

### 1. Single-Pass Extraction

**Decision**: Extract all chunk types in a single AST traversal.

**Rationale**:
- More efficient than multiple passes
- Reduces parsing overhead
- Faster overall processing

**Trade-offs**:
- More complex extraction logic
- Harder to optimize individual extractors

### 2. Lazy Evaluation

**Decision**: Parse AST only when needed.

**Rationale**:
- Faster for cached files
- Reduces unnecessary work
- Better resource usage

**Trade-offs**:
- More complex caching logic
- May parse same file multiple times

## Future Considerations

### 1. Multi-Language Support

**Decision**: Start with TypeScript/JavaScript, design for extension.

**Rationale**:
- Focus on one language first
- Validate approach before expanding
- Architecture supports multiple languages

### 2. Incremental Parsing

**Decision**: Not implemented yet, but architecture supports it.

**Rationale**:
- Complex feature
- Can add later if needed
- Current approach works for most cases

### 3. Custom Extractors

**Decision**: Not exposed yet, but extractor pattern supports it.

**Rationale**:
- Keep API simple initially
- Can add plugin system later
- Extractor pattern makes it possible

## Comparison with CAST

### Similarities
- AST-based chunking
- Structure-preserving boundaries
- Semantic unit extraction
- Metadata-rich chunks

### Differences
- CAST focuses on multiple languages, we start with TS/JS
- CAST has more sophisticated splitting, we keep it simpler
- CAST is research-focused, we're production-oriented
- We provide multiple interfaces (CLI, API, library)

## Lessons Learned

1. **Parser Abstraction**: Essential for flexibility
2. **Metadata Matters**: Rich metadata improves retrieval
3. **Stable IDs**: Critical for incremental updates
4. **Error Resilience**: Important for production use
5. **Multiple Interfaces**: Different users need different access patterns
