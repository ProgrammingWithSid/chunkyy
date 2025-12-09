import cors from 'cors';
import express from 'express';
import { Chunkyyy } from '../chunkyyy';
import { ChunkingOptions } from '../types';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let chunkyyyInstance: Chunkyyy | null = null;

function getChunkyyy(options?: ChunkingOptions): Chunkyyy {
  if (!chunkyyyInstance || options) {
    chunkyyyInstance = new Chunkyyy(options || {});
  }
  return chunkyyyInstance;
}

/**
 * POST /api/chunk
 * Chunk code from request body
 */
app.post('/api/chunk', async (req, res) => {
  try {
    const { code, path: filePath, options } = req.body;

    if (!code || !filePath) {
      return res.status(400).json({
        error: 'Missing required fields: code and path',
      });
    }

    const chunkyyy = getChunkyyy(options);
    const chunks = chunkyyy.chunkCode(code, filePath);

    res.json({
      chunks: chunks.map((chunk) => ({
        ...chunk,
        content: undefined, // Don't send content in response by default
      })),
      count: chunks.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      error: errorMessage,
    });
  }
});

/**
 * POST /api/chunk/file
 * Chunk a file from the filesystem
 */
app.post('/api/chunk/file', async (req, res) => {
  try {
    const { path: filePath, options } = req.body;

    if (!filePath) {
      return res.status(400).json({
        error: 'Missing required field: path',
      });
    }

    const chunkyyy = getChunkyyy(options);
    const chunks = await chunkyyy.chunkFile(filePath);

    res.json({
      chunks: chunks.map((chunk) => ({
        ...chunk,
        content: undefined,
      })),
      count: chunks.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      error: errorMessage,
    });
  }
});

/**
 * POST /api/chunk/directory
 * Chunk a directory
 */
app.post('/api/chunk/directory', async (req, res) => {
  try {
    const { path: dirPath, options } = req.body;

    if (!dirPath) {
      return res.status(400).json({
        error: 'Missing required field: path',
      });
    }

    const chunkyyy = getChunkyyy(options);
    const result = await chunkyyy.chunkDirectory(dirPath, { recursive: true });

    res.json({
      ...result,
      chunks: result.chunks.map((chunk) => ({
        ...chunk,
        content: undefined,
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      error: errorMessage,
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

/**
 * POST /api/analyze/dependencies
 * Analyze dependencies for chunks
 */
app.post('/api/analyze/dependencies', async (req, res) => {
  try {
    const { chunks } = req.body;

    if (!chunks || !Array.isArray(chunks)) {
      return res.status(400).json({
        error: 'Missing required field: chunks (array)',
      });
    }

    const chunkyyy = getChunkyyy();
    const dependencyGraph = chunkyyy['chunker'].buildDependencyGraph(chunks);
    const importExportMap = chunkyyy['chunker'].buildImportExportMap(chunks);

    res.json({
      dependencyGraph,
      importExportMap: {
        exports: Object.fromEntries(importExportMap.exports),
        imports: Object.fromEntries(importExportMap.imports),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      error: errorMessage,
    });
  }
});

/**
 * GET /api/metadata/:chunkId
 * Get detailed metadata for a specific chunk
 */
app.get('/api/metadata/:chunkId', async (req, res) => {
  try {
    const { chunkId } = req.params;
    const { chunks } = req.query;

    if (!chunks) {
      return res.status(400).json({
        error: 'Missing required query parameter: chunks (JSON array)',
      });
    }

    const chunksArray = typeof chunks === 'string' ? JSON.parse(chunks) : chunks;
    const chunk = chunksArray.find((c: { id: string }) => c.id === chunkId);

    if (!chunk) {
      return res.status(404).json({
        error: 'Chunk not found',
      });
    }

    // Return enhanced metadata
    res.json({
      id: chunk.id,
      name: chunk.name,
      qualifiedName: chunk.qualifiedName,
      type: chunk.type,
      filePath: chunk.filePath,
      metadata: {
        parameters: chunk.parameters,
        returnType: chunk.returnType,
        decorators: chunk.decorators,
        typeParameters: chunk.typeParameters,
        jsdoc: chunk.jsdoc,
        exported: chunk.exported,
        exportName: chunk.exportName,
        visibility: chunk.visibility,
        async: chunk.async,
        generator: chunk.generator,
        dependencies: chunk.dependencies,
        childrenIds: chunk.childrenIds,
        parentId: chunk.parentId,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      error: errorMessage,
    });
  }
});

/**
 * POST /api/extract
 * Extract code chunks with dependencies for specified file ranges
 */
app.post('/api/extract', async (req, res) => {
  try {
    const { requests } = req.body;

    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({
        error: 'Missing or invalid requests array',
      });
    }

    // Validate request format
    for (const request of requests) {
      if (!request.filePath || !request.ranges || !Array.isArray(request.ranges)) {
        return res.status(400).json({
          error: 'Invalid request format. Each request must have filePath and ranges array',
        });
      }
      for (const range of request.ranges) {
        if (typeof range.start !== 'number' || typeof range.end !== 'number') {
          return res.status(400).json({
            error: 'Invalid range format. Each range must have start and end line numbers',
          });
        }
      }
    }

    const chunkyyy = getChunkyyy();
    const result = await chunkyyy.extractCodeWithDependencies(requests);

    // Convert Map to object for JSON serialization
    const codeBlocksObj: Record<string, string> = {};
    result.codeBlocks.forEach((value, key) => {
      codeBlocksObj[key] = value;
    });

    res.json({
      selectedChunks: result.selectedChunks.map((chunk) => ({
        ...chunk,
        content: undefined, // Don't send content by default
      })),
      dependentChunks: result.dependentChunks.map((chunk) => ({
        ...chunk,
        content: undefined,
      })),
      allChunks: result.allChunks.map((chunk) => ({
        ...chunk,
        content: undefined,
      })),
      codeBlocks: codeBlocksObj,
      dependencyGraph: result.dependencyGraph,
      stats: {
        selectedCount: result.selectedChunks.length,
        dependentCount: result.dependentChunks.length,
        totalCount: result.allChunks.length,
        filesCount: result.codeBlocks.size,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      error: errorMessage,
    });
  }
});

/**
 * GET /api/docs
 * API documentation
 */
app.get('/api/docs', (req, res) => {
  res.json({
    endpoints: [
      {
        method: 'POST',
        path: '/api/chunk',
        description: 'Chunk code from request body',
        body: {
          code: 'string (required)',
          path: 'string (required)',
          options: 'ChunkingOptions (optional)',
        },
      },
      {
        method: 'POST',
        path: '/api/chunk/file',
        description: 'Chunk a file from filesystem',
        body: {
          path: 'string (required)',
          options: 'ChunkingOptions (optional)',
        },
      },
      {
        method: 'POST',
        path: '/api/chunk/directory',
        description: 'Chunk a directory',
        body: {
          path: 'string (required)',
          options: 'ChunkingOptions (optional)',
        },
      },
      {
        method: 'POST',
        path: '/api/analyze/dependencies',
        description: 'Analyze dependencies for chunks',
        body: {
          chunks: 'Chunk[] (required)',
        },
      },
      {
        method: 'GET',
        path: '/api/metadata/:chunkId',
        description: 'Get detailed metadata for a chunk',
        query: {
          chunks: 'Chunk[] (required)',
        },
      },
      {
        method: 'GET',
        path: '/api/health',
        description: 'Health check',
      },
      {
        method: 'POST',
        path: '/api/extract',
        description: 'Extract code chunks with dependencies for specified file ranges',
        body: {
          requests:
            'FileRangeRequest[] (required) - Array of { filePath: string, ranges: [{ start: number, end: number }] }',
        },
      },
    ],
  });
});

export function startServer(port: number = 3000) {
  app.listen(port, () => {
    console.log(`🚀 Chunkyyy API server running on http://localhost:${port}`);
    console.log(`📚 API docs: http://localhost:${port}/api/docs`);
  });
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(port);
}
