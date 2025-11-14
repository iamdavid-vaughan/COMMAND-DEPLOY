#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const COPYRIGHT_HEADER = `/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * This file is part of Focal Deploy, a proprietary deployment automation platform.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without express written permission.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 *
 * For licensing inquiries: licensing@focal-deploy.com
 * For support: support@focal-deploy.com
 *
 * @author Focal Deploy Team
 * @copyright 2025 Focal Deploy
 * @license Proprietary
 */

`;

function hasCopyrightHeader(content) {
  return content.includes('Copyright (c) 2025 Focal Deploy') ||
         content.includes('@copyright 2025 Focal Deploy');
}

function hasShebang(content) {
  return content.startsWith('#!');
}

function addCopyrightToFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    if (hasCopyrightHeader(content)) {
      console.log(`⏭️  Skipped: ${filePath}`);
      return false;
    }

    // Skip backup files
    if (filePath.includes('.bckup') || filePath.includes('.bkup') || filePath.includes('_old')) {
      console.log(`⏭️  Skipped (backup): ${filePath}`);
      return false;
    }

    let newContent;
    if (hasShebang(content)) {
      const lines = content.split('\n');
      const shebang = lines[0];
      const restOfFile = lines.slice(1).join('\n').trimStart();
      newContent = `${shebang}\n\n${COPYRIGHT_HEADER}${restOfFile}`;
    } else {
      newContent = COPYRIGHT_HEADER + content;
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Added header: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error: ${filePath}: ${error.message}`);
    return false;
  }
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walkDir(filePath, callback);
      }
    } else if (file.endsWith('.js')) {
      callback(filePath);
    }
  });
}

console.log('📝 Adding Copyright Headers\n');

let added = 0;
let skipped = 0;

const dirs = ['lib', 'bin'];

dirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (fs.existsSync(dirPath)) {
    console.log(`\nProcessing ${dir}/...`);
    walkDir(dirPath, filePath => {
      if (addCopyrightToFile(filePath)) {
        added++;
      } else {
        skipped++;
      }
    });
  }
});

console.log(`\n📊 Summary:`);
console.log(`✅ Added: ${added}`);
console.log(`⏭️  Skipped: ${skipped}`);
console.log(`Total: ${added + skipped}`);
