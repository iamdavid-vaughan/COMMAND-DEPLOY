#!/usr/bin/env node

/**
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

const fs = require('fs-extra');
const path = require('path');
const { globSync } = require('glob');
const chalk = require('chalk');

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

const SHEBANG_HEADER = `#!/usr/bin/env node

/**
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

/**
 * Check if file already has a copyright header
 */
function hasCopyrightHeader(content) {
  return content.includes('Copyright (c) 2025 Focal Deploy') ||
         content.includes('@copyright') ||
         content.includes('Proprietary License');
}

/**
 * Check if file starts with shebang
 */
function hasShebang(content) {
  return content.startsWith('#!');
}

/**
 * Add copyright header to a file
 */
async function addCopyrightToFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');

    // Skip if already has copyright
    if (hasCopyrightHeader(content)) {
      console.log(chalk.gray(`⏭️  Skipped (already has header): ${filePath}`));
      return { skipped: true };
    }

    // Skip backup files
    if (filePath.includes('.bckup') || filePath.includes('.bkup')) {
      console.log(chalk.gray(`⏭️  Skipped (backup file): ${filePath}`));
      return { skipped: true };
    }

    let newContent;

    if (hasShebang(content)) {
      // Preserve shebang and add copyright after it
      const lines = content.split('\n');
      const shebang = lines[0];
      const restOfFile = lines.slice(1).join('\n').trimStart();
      newContent = `${shebang}\n\n${COPYRIGHT_HEADER}${restOfFile}`;
    } else {
      // Add copyright at the beginning
      newContent = COPYRIGHT_HEADER + content;
    }

    await fs.writeFile(filePath, newContent, 'utf8');
    console.log(chalk.green(`✅ Added header: ${filePath}`));
    return { added: true };

  } catch (error) {
    console.error(chalk.red(`❌ Error processing ${filePath}: ${error.message}`));
    return { error: true };
  }
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold.cyan('\n📝 Adding Copyright Headers to Focal Deploy Source Files\n'));

  const patterns = [
    'lib/**/*.js',
    'bin/**/*.js',
    'scripts/**/*.js'
  ];

  let stats = {
    total: 0,
    added: 0,
    skipped: 0,
    errors: 0
  };

  for (const pattern of patterns) {
    console.log(chalk.gray(`\nProcessing: ${pattern}`));
    const files = globSync(pattern, { cwd: process.cwd() });

    for (const file of files) {
      const filePath = path.join(process.cwd(), file);
      stats.total++;

      const result = await addCopyrightToFile(filePath);

      if (result.added) stats.added++;
      if (result.skipped) stats.skipped++;
      if (result.error) stats.errors++;
    }
  }

  // Summary
  console.log(chalk.bold.cyan('\n📊 Summary:'));
  console.log(chalk.white(`Total files processed: ${stats.total}`));
  console.log(chalk.green(`✅ Headers added: ${stats.added}`));
  console.log(chalk.gray(`⏭️  Skipped: ${stats.skipped}`));
  console.log(chalk.red(`❌ Errors: ${stats.errors}`));

  if (stats.added > 0) {
    console.log(chalk.bold.green('\n✅ Copyright headers successfully added!'));
  } else {
    console.log(chalk.bold.yellow('\n⚠️  No new headers added (all files already have headers or were skipped)'));
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
