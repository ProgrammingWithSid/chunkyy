import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { ASTNode } from '../types';

/**
 * Cache entry for AST results
 */
interface ASTCacheEntry {
  ast: ASTNode;
  hash: string;
  timestamp: number;
}

/**
 * AST cache for storing parsed ASTs
 * Reduces redundant parsing of unchanged files
 */
export class ASTCache {
  private cache: Map<string, ASTCacheEntry> = new Map();
  private ttl: number; // Time to live in milliseconds
  private maxSize: number;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(ttl: number = 5 * 60 * 1000, maxSize: number = 1000) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  /**
   * Get cached AST for a file
   */
  get(filePath: string, contentHash: string): ASTNode | null {
    const entry = this.cache.get(filePath);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check hash match
    if (entry.hash !== contentHash) {
      this.stats.misses++;
      this.cache.delete(filePath);
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.stats.misses++;
      this.cache.delete(filePath);
      return null;
    }

    this.stats.hits++;
    return entry.ast;
  }

  /**
   * Set cached AST for a file
   */
  set(filePath: string, contentHash: string, ast: ASTNode): void {
    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(filePath, {
      ast,
      hash: contentHash,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache for a file
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Generate content hash for a file
   */
  static generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Generate file hash based on file stats
   */
  static generateFileHash(filePath: string, rootDir: string): string {
    try {
      const fullPath = path.resolve(rootDir, filePath);
      const stats = fs.statSync(fullPath);
      // Use modification time and size as hash
      return `${stats.mtime.getTime()}-${stats.size}`;
    } catch {
      return '';
    }
  }
}
