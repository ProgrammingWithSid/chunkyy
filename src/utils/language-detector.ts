import * as path from 'path';
import { SupportedLanguage } from '../types';

/**
 * Detect programming language from file extension
 */
export function detectLanguage(filePath: string): SupportedLanguage {
  const ext = path.extname(filePath).toLowerCase();

  const languageMap: Record<string, SupportedLanguage> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.vue': 'vue',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.rb': 'ruby',
    '.php': 'php',
  };

  return languageMap[ext] || 'typescript';
}

/**
 * Check if file extension is supported
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const supportedExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.vue',
    '.py',
    '.java',
    '.go',
    '.rs',
    '.cpp',
    '.cc',
    '.cxx',
    '.c',
    '.h',
    '.hpp',
    '.rb',
    '.php',
  ];

  return supportedExtensions.includes(ext);
}

/**
 * Get parser type for a language
 */
export function getParserTypeForLanguage(language: SupportedLanguage): 'typescript' | 'treesitter' {
  if (language === 'typescript' || language === 'javascript' || language === 'vue') {
    return 'typescript';
  }
  return 'treesitter';
}
