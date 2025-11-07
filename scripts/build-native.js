#!/usr/bin/env node

/**
 * Build script for native modules across different architectures
 * This script ensures native modules like keytar are built for the correct architecture
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const nativeModules = ['keytar'];

function buildForArchitecture(arch) {
  console.log(`\n🔧 Building native modules for ${arch}...`);

  try {
    // Set the target architecture
    const env = {
      ...process.env,
      npm_config_arch: arch,
      npm_config_target_arch: arch
    };

    // Rebuild each native module
    for (const module of nativeModules) {
      console.log(`  📦 Rebuilding ${module} for ${arch}...`);

      try {
        execSync(
          `npm rebuild ${module} --update-binary`,
          {
            stdio: 'inherit',
            env
          }
        );
        console.log(`  ✅ ${module} built successfully for ${arch}`);
      } catch (error) {
        console.warn(`  ⚠️  Warning: Could not rebuild ${module} for ${arch}`);
        console.warn(`      This is expected if building on a different architecture.`);
      }
    }
  } catch (error) {
    console.error(`\n❌ Error building native modules for ${arch}:`, error.message);
    throw error;
  }
}

// Get target architecture from command line or use current
const targetArch = process.argv[2] || process.arch;

console.log(`🚀 Starting native module build process...`);
console.log(`📍 Current architecture: ${process.arch}`);
console.log(`🎯 Target architecture: ${targetArch}`);

buildForArchitecture(targetArch);

console.log(`\n✅ Native module build complete!`);
