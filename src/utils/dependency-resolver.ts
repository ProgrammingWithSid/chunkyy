import * as fs from 'fs';
import * as path from 'path';
import { Dependency } from '../types';

interface TsConfig {
  compilerOptions?: {
    paths?: Record<string, string[]>;
  };
}

/**
 * Enhanced dependency resolver with TypeScript path alias and barrel export support
 */
export class EnhancedDependencyResolver {
  private tsConfigCache: Map<string, TsConfig | null> = new Map();
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /**
   * Resolve dependency with enhanced strategies
   */
  async resolveDependency(dep: Dependency, fromFilePath: string): Promise<string[]> {
    const resolvedPaths: string[] = [];

    // Strategy 1: Resolve TypeScript path aliases
    if (dep.source && !dep.source.startsWith('.')) {
      const aliasPath = await this.resolvePathAlias(dep.source);
      if (aliasPath) {
        resolvedPaths.push(aliasPath);
      }
    }

    // Strategy 2: Resolve relative imports
    if (dep.source && dep.source.startsWith('.')) {
      const relativePath = this.resolveRelativePath(dep.source, fromFilePath);
      if (relativePath) {
        resolvedPaths.push(relativePath);
      }
    }

    // Strategy 3: Resolve barrel exports
    if (resolvedPaths.length > 0) {
      const barrelResolved = await this.resolveBarrelExports(resolvedPaths[0], dep.name);
      if (barrelResolved.length > 0) {
        return barrelResolved;
      }
    }

    return resolvedPaths;
  }

  /**
   * Resolve TypeScript path alias
   */
  private async resolvePathAlias(importPath: string): Promise<string | null> {
    const tsConfig = await this.loadTsConfig();
    if (!tsConfig?.compilerOptions?.paths) {
      return null;
    }

    const paths = tsConfig.compilerOptions.paths;

    // Find matching path alias
    for (const [pattern, replacements] of Object.entries(paths)) {
      // Convert pattern to regex (e.g., "@/*" -> "@/(.*)")
      const regexPattern = pattern.replace(/\*/g, '(.+)');
      const regex = new RegExp('^' + regexPattern + '$');
      const match = importPath.match(regex);

      if (match) {
        const replacement = Array.isArray(replacements) ? replacements[0] : replacements;
        if (typeof replacement === 'string') {
          // Replace * with matched group
          const resolved = replacement.replace(/\*/g, match[1] || '');
          return path.resolve(this.rootDir, resolved);
        }
      }
    }

    return null;
  }

  /**
   * Resolve relative import path
   */
  private resolveRelativePath(importPath: string, fromFilePath: string): string | null {
    const dir = path.dirname(path.resolve(this.rootDir, fromFilePath));
    const resolved = path.resolve(dir, importPath);

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', ''];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (this.fileExists(withExt)) {
        return path.relative(this.rootDir, withExt);
      }
    }

    // Try index files
    for (const ext of extensions) {
      const indexPath = path.join(resolved, `index${ext}`);
      if (this.fileExists(indexPath)) {
        return path.relative(this.rootDir, indexPath);
      }
    }

    return null;
  }

  /**
   * Resolve barrel exports (index.ts re-exports)
   */
  private async resolveBarrelExports(filePath: string): Promise<string[]> {
    if (!this.isBarrelFile(filePath)) {
      return [];
    }

    try {
      const fullPath = path.resolve(this.rootDir, filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Simple regex-based extraction (could be enhanced with AST parsing)
      const reExportPattern = new RegExp(`export\\s+.*?from\\s+['"](.+?)['"]`, 'g');
      const matches = Array.from(content.matchAll(reExportPattern));

      const resolvedPaths: string[] = [];
      for (const match of matches) {
        const sourcePath = match[1];
        const dir = path.dirname(fullPath);
        const resolved = path.resolve(dir, sourcePath);

        // Try to find the actual file
        const extensions = ['.ts', '.tsx', '.js', '.jsx'];
        for (const ext of extensions) {
          const withExt = resolved + ext;
          if (this.fileExists(withExt)) {
            resolvedPaths.push(path.relative(this.rootDir, withExt));
            break;
          }
        }
      }

      return resolvedPaths;
    } catch {
      return [];
    }
  }

  /**
   * Check if file is a barrel file (index.ts/js)
   */
  private isBarrelFile(filePath: string): boolean {
    const basename = path.basename(filePath);
    return basename === 'index.ts' || basename === 'index.js';
  }

  /**
   * Load tsconfig.json
   */
  private async loadTsConfig(): Promise<TsConfig | null> {
    const cached = this.tsConfigCache.get(this.rootDir);
    if (cached) {
      return cached;
    }

    const tsConfigPath = path.join(this.rootDir, 'tsconfig.json');
    if (!this.fileExists(tsConfigPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(tsConfigPath, 'utf-8');
      const config = JSON.parse(content);
      this.tsConfigCache.set(this.rootDir, config);
      return config;
    } catch {
      return null;
    }
  }

  /**
   * Check if file exists
   */
  private fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Clear tsconfig cache
   */
  clearCache(): void {
    this.tsConfigCache.clear();
  }
}
