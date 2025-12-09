#!/usr/bin/env node

/**
 * Post-build script to add .js extensions to relative require statements
 * This fixes module resolution issues with pnpm file links
 */
const fs = require('fs');
const path = require('path');

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
        (match, quote1, path, quote2) => {
          // Skip if already has extension
          if (path.endsWith('.js') || path.endsWith('.json')) {
            return match;
          }
          modified = true;
          return `require(${quote1}${path}.js${quote2})`;
        }
      );

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed requires in: ${filePath}`);
      }
    }
  }
}

const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  fixRequires(distDir);
  console.log('Finished fixing require statements');
} else {
  console.error('dist directory not found');
  process.exit(1);
}

