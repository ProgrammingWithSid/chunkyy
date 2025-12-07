import { ParserAdapter, ParserType } from '../types';
import { detectLanguage, getParserTypeForLanguage } from '../utils/language-detector';
import { TreeSitterAdapter } from './treesitter-adapter';
import { TypeScriptAdapter } from './typescript-adapter';

/**
 * Create a parser adapter based on type and file path
 */
export function createParser(type: ParserType, filePath?: string): ParserAdapter {
  // Auto-detect language from file path if treesitter is requested
  if (type === 'treesitter' && filePath) {
    const language = detectLanguage(filePath);
    return new TreeSitterAdapter(language);
  }

  // Auto-detect parser type from file path if not specified
  if (filePath && type === 'typescript') {
    const detectedLanguage = detectLanguage(filePath);
    const detectedParserType = getParserTypeForLanguage(detectedLanguage);

    if (detectedParserType === 'treesitter') {
      return new TreeSitterAdapter(detectedLanguage);
    }
  }

  switch (type) {
    case 'typescript':
      return new TypeScriptAdapter();
    case 'treesitter':
      // Default to TypeScript if no file path provided
      return new TreeSitterAdapter('typescript');
    case 'swc':
      // TODO: Implement SWC adapter
      throw new Error('SWC adapter not yet implemented');
    case 'babel':
      // TODO: Implement Babel adapter
      throw new Error('Babel adapter not yet implemented');
    case 'esprima':
      // TODO: Implement Esprima adapter
      throw new Error('Esprima adapter not yet implemented');
    default:
      throw new Error(`Unknown parser type: ${type}`);
  }
}

export { ParserAdapter } from '../types';
export { TreeSitterAdapter } from './treesitter-adapter';
export { TypeScriptAdapter } from './typescript-adapter';
