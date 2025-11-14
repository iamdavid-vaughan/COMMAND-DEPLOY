#!/bin/bash

# Package script for building cross-architecture binaries with native modules
# This script ensures native modules are built for the correct target architecture

set -e

echo "🚀 Starting cross-architecture packaging..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to build for a specific architecture
build_for_arch() {
  local platform=$1
  local arch=$2
  local node_version="18"

  echo -e "${BLUE}📦 Building for ${platform}-${arch}...${NC}"

  # Create a temporary directory for this build
  local build_dir="./build-temp/${platform}-${arch}"
  rm -rf "$build_dir"
  mkdir -p "$build_dir"

  # Install dependencies for the target architecture
  echo -e "${YELLOW}  Installing dependencies for ${arch}...${NC}"

  # Set npm config for target architecture
  export npm_config_arch=$arch
  export npm_config_target_arch=$arch

  # Copy package files
  cp -r node_modules "$build_dir/"

  # Rebuild native modules for target architecture
  echo -e "${YELLOW}  Rebuilding native modules...${NC}"

  # Try to rebuild keytar for the target architecture
  if command -v node-gyp &> /dev/null; then
    (cd node_modules/keytar && node-gyp rebuild --target=${node_version} --arch=${arch}) || echo -e "${RED}  ⚠️  Could not rebuild keytar for ${arch}${NC}"
  else
    echo -e "${RED}  ⚠️  node-gyp not found, skipping native rebuild${NC}"
  fi

  # Package with pkg
  echo -e "${YELLOW}  Packaging with pkg...${NC}"

  case $platform in
    macos)
      pkg . --targets node18-macos-${arch} --out-path dist/${platform}
      ;;
    linux)
      pkg . --targets node18-linux-${arch} --out-path dist/${platform}
      ;;
    windows)
      pkg . --targets node18-win-${arch} --out-path dist/${platform}
      ;;
  esac

  # Clean up
  rm -rf "$build_dir"

  echo -e "${GREEN}  ✅ Build complete for ${platform}-${arch}${NC}"
  echo ""
}

# Check if pkg is installed
if ! command -v pkg &> /dev/null; then
  echo -e "${RED}❌ Error: pkg is not installed${NC}"
  echo "Install it with: npm install -g pkg"
  exit 1
fi

# Parse command line arguments
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: $0 [platform] [architecture]"
  echo ""
  echo "Examples:"
  echo "  $0                    # Build all platforms and architectures"
  echo "  $0 macos              # Build all macOS architectures"
  echo "  $0 macos arm64        # Build only macOS ARM64"
  echo ""
  echo "Platforms: macos, linux, windows"
  echo "Architectures: x64, arm64"
  exit 0
fi

# Build based on arguments
if [ -z "$1" ]; then
  # Build all
  echo -e "${BLUE}🌎 Building for all platforms and architectures...${NC}"
  echo ""

  build_for_arch "macos" "x64"
  build_for_arch "macos" "arm64"
  build_for_arch "linux" "x64"
  build_for_arch "linux" "arm64"
  build_for_arch "windows" "x64"

elif [ -z "$2" ]; then
  # Build all architectures for a platform
  case $1 in
    macos)
      build_for_arch "macos" "x64"
      build_for_arch "macos" "arm64"
      ;;
    linux)
      build_for_arch "linux" "x64"
      build_for_arch "linux" "arm64"
      ;;
    windows)
      build_for_arch "windows" "x64"
      ;;
    *)
      echo -e "${RED}❌ Error: Unknown platform '$1'${NC}"
      echo "Valid platforms: macos, linux, windows"
      exit 1
      ;;
  esac
else
  # Build specific platform and architecture
  build_for_arch "$1" "$2"
fi

echo -e "${GREEN}✅ All builds complete!${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT NOTE:${NC}"
echo "Native modules like keytar require building on the target architecture."
echo "For production builds:"
echo "  • macOS ARM64: Build on Apple Silicon Mac"
echo "  • macOS x64: Build on Intel Mac"
echo "  • Linux ARM64: Build on ARM64 Linux or use Docker with ARM64 emulation"
echo "  • Linux x64: Build on x64 Linux"
echo ""
echo "Or use GitHub Actions with matrix builds for each architecture."
