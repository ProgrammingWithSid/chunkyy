#!/usr/bin/env node

/**
 * Post-build script to add .js extensions to relative require statements
 * This fixes module resolution issues with pnpm file links
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

/**
 * Resolve a relative require path to the correct .js file
 * Handles both direct files and directory imports (index.js)
 */
function resolveRequirePath(requirePath, fromFilePath) {
  // Get the directory of the file containing the require
  const fromDir = path.dirname(fromFilePath);

  // Resolve the absolute path of the require target
  const absolutePath = path.resolve(fromDir, requirePath);

  // Check if it's a direct .js file
  if (fs.existsSync(absolutePath + '.js')) {
    return requirePath + '.js';
  }

  // Check if it's a directory with an index.js
  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
    const indexPath = path.join(absolutePath, 'index.js');
    if (fs.existsSync(indexPath)) {
      return requirePath + '/index.js';
    }
  }

  // Fallback: just add .js extension
  return requirePath + '.js';
}

function fixRequires(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      fixRequires(filePath);
    } else if (file.endsWith('.js') && !file.endsWith('.d.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      // Fix relative requires without extensions
      // Match: require("../utils/type-guards") or require('./something')
      // But not: require('typescript') or require('fs')
      content = content.replace(
        /require\((['"])(\.\.?\/[^'"]+)(['"])\)/g,
        (match, quote1, reqPath, quote2) => {
          // Skip if already has extension
          if (reqPath.endsWith('.js') || reqPath.endsWith('.json')) {
            return match;
          }
          const resolvedPath = resolveRequirePath(reqPath, filePath);
          modified = true;
          return `require(${quote1}${resolvedPath}${quote2})`;
        }
      );

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed requires in: ${filePath}`);
      }
    }
  }
}

if (fs.existsSync(distDir)) {
  fixRequires(distDir);
  console.log('Finished fixing require statements');
} else {
  console.error('dist directory not found');
  process.exit(1);
}
