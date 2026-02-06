#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Chunkyyy } from '../chunkyyy';
import { ChunkingOptions } from '../types';

interface CLIArgs {
  command: 'chunk' | 'watch' | 'serve';
  input?: string;
  output?: string;
  outputDir?: string;
  parser?: 'typescript' | 'treesitter';
  chunkSize?: number;
  port?: number;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const command = args[0];
  const parsed: CLIArgs = {
    command: command === 'chunk' || command === 'watch' || command === 'serve' ? command : 'chunk',
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--input':
      case '-i':
        parsed.input = next;
        i++;
        break;
      case '--output':
      case '-o':
        parsed.output = next;
        i++;
        break;
      case '--output-dir':
      case '-d':
        parsed.outputDir = next;
        i++;
        break;
      case '--parser':
      case '-p':
        parsed.parser = next as 'typescript' | 'treesitter';
        i++;
        break;
      case '--chunk-size':
      case '-s':
        parsed.chunkSize = parseInt(next, 10);
        i++;
        break;
      case '--port':
        parsed.port = parseInt(next, 10);
        i++;
        break;
    }
  }

  return parsed;
}

async function chunkCommand(args: CLIArgs) {
  if (!args.input) {
    console.error('Error: --input is required for chunk command');
    process.exit(1);
  }

  const options: ChunkingOptions = {
    parser: args.parser || 'typescript',
    chunkSize: args.chunkSize || 512,
  };

  const chunkyyy = new Chunkyyy(options);
  const inputPath = path.resolve(args.input);

  let result;
  if (fs.statSync(inputPath).isDirectory()) {
    result = await chunkyyy.chunkDirectory(inputPath, { recursive: true });
  } else {
    const chunks = await chunkyyy.chunkFile(inputPath);
    result = {
      chunks,
      dependencyGraph: chunkyyy['chunker'].buildDependencyGraph(chunks),
      importExportMap: chunkyyy['chunker'].buildImportExportMap(chunks),
      stats: chunkyyy['chunker']['calculateStats'](chunks, 1),
    };
  }

  // Output results
  if (args.output) {
    fs.writeFileSync(args.output, JSON.stringify(result, null, 2));
    console.log(
      `✓ Chunked ${result.stats.totalFiles} files into ${result.stats.totalChunks} chunks`
    );
    console.log(`✓ Results written to ${args.output}`);
  } else if (args.outputDir) {
    // Write individual chunk files
    if (!fs.existsSync(args.outputDir)) {
      fs.mkdirSync(args.outputDir, { recursive: true });
    }

    for (const chunk of result.chunks) {
      const chunkFile = path.join(args.outputDir, `${chunk.id}.json`);
      fs.writeFileSync(chunkFile, JSON.stringify(chunk, null, 2));
    }

    // Write metadata
    const metadataFile = path.join(args.outputDir, 'metadata.json');
    fs.writeFileSync(
      metadataFile,
      JSON.stringify(
        {
          dependencyGraph: result.dependencyGraph,
          importExportMap: result.importExportMap,
          stats: result.stats,
        },
        null,
        2
      )
    );

    console.log(
      `✓ Chunked ${result.stats.totalFiles} files into ${result.stats.totalChunks} chunks`
    );
    console.log(`✓ Chunks written to ${args.outputDir}`);
  } else {
    // Output to stdout
    console.log(JSON.stringify(result, null, 2));
  }
}

async function watchCommand(args: CLIArgs) {
  if (!args.input) {
    console.error('Error: --input is required for watch command');
    process.exit(1);
  }

  const options: ChunkingOptions = {
    parser: args.parser || 'typescript',
    chunkSize: args.chunkSize || 512,
  };

  const chunkyyy = new Chunkyyy(options);
  const inputPath = path.resolve(args.input);
  const outputDir = args.outputDir || path.join(process.cwd(), '.chunkyyy-cache');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Watching ${inputPath} for changes...`);
  console.log(`Output directory: ${outputDir}`);

  // Initial chunking
  if (fs.statSync(inputPath).isDirectory()) {
    const result = await chunkyyy.chunkDirectory(inputPath, { recursive: true });
    console.log(`✓ Initial chunking: ${result.stats.totalChunks} chunks`);
  }

  // Watch for changes
  const chokidar = await import('chokidar');
  const watcher = chokidar.default.watch(inputPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
  });

  watcher.on('change', async (filePath) => {
    console.log(`File changed: ${filePath}`);
    try {
      // Convert absolute path to relative path for chunkFile
      const relativePath = path.relative(process.cwd(), filePath);
      const chunks = await chunkyyy.chunkFile(relativePath);
      console.log(`✓ Re-chunked: ${chunks.length} chunks`);
    } catch (error) {
      console.error(`Error chunking ${filePath}:`, error);
    }
  });

  console.log('Press Ctrl+C to stop watching');
}

async function serveCommand(args: CLIArgs) {
  const port = args.port || 3000;
  console.log(`Starting API server on port ${port}...`);

  // Import and start the API server
  const { startServer } = await import('../api/server');
  startServer(port);
}

async function main() {
  const args = parseArgs();

  try {
    switch (args.command) {
      case 'chunk':
        await chunkCommand(args);
        break;
      case 'watch':
        await watchCommand(args);
        break;
      case 'serve':
        await serveCommand(args);
        break;
      default:
        console.error(`Unknown command: ${args.command}`);
        console.log('Usage: chunkyyy <chunk|watch|serve> [options]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
