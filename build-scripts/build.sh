#!/bin/bash

# Focal Deploy Build Script
# Builds cross-platform executables for distribution

set -e

echo "🚀 Building Focal Deploy v2.0 Cross-Platform Executables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the focal-deploy root directory.${NC}"
    exit 1
fi

# Check if pkg is installed
if ! command -v pkg &> /dev/null; then
    echo -e "${YELLOW}⚠️  pkg not found. Installing pkg globally...${NC}"
    npm install -g pkg
fi

# Create dist directory
echo -e "${BLUE}📁 Creating distribution directory...${NC}"
mkdir -p dist/{macos,linux,windows}

# Clean previous builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf dist/macos/*
rm -rf dist/linux/*
rm -rf dist/windows/*

# Build for macOS
echo -e "${BLUE}🍎 Building for macOS (x64 and ARM64)...${NC}"
pkg . --targets node18-macos-x64 --out-path dist/macos --compress GZip
pkg . --targets node18-macos-arm64 --out-path dist/macos --compress GZip

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ macOS builds completed successfully${NC}"
else
    echo -e "${RED}❌ macOS build failed${NC}"
    exit 1
fi

# Build for Linux
echo -e "${BLUE}🐧 Building for Linux (x64 and ARM64)...${NC}"
pkg . --targets node18-linux-x64 --out-path dist/linux --compress GZip
pkg . --targets node18-linux-arm64 --out-path dist/linux --compress GZip

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Linux builds completed successfully${NC}"
else
    echo -e "${RED}❌ Linux build failed${NC}"
    exit 1
fi

# Build for Windows
echo -e "${BLUE}🪟 Building for Windows (x64)...${NC}"
pkg . --targets node18-win-x64 --out-path dist/windows --compress GZip

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Windows build completed successfully${NC}"
else
    echo -e "${RED}❌ Windows build failed${NC}"
    exit 1
fi

# Create checksums
echo -e "${BLUE}🔐 Generating checksums...${NC}"
cd dist

# macOS checksums
cd macos
shasum -a 256 * > checksums.txt
cd ..

# Linux checksums
cd linux
sha256sum * > checksums.txt
cd ..

# Windows checksums
cd windows
if command -v sha256sum &> /dev/null; then
    sha256sum * > checksums.txt
else
    shasum -a 256 * > checksums.txt
fi
cd ..

cd ..

# Display build summary
echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}📦 Build artifacts:${NC}"
echo ""

# List all built files with sizes
find dist -name "focal-deploy*" -type f | while read file; do
    size=$(du -h "$file" | cut -f1)
    echo -e "  ${GREEN}✓${NC} $file (${size})"
done

echo ""
echo -e "${BLUE}📋 Distribution structure:${NC}"
tree dist/ 2>/dev/null || find dist -type f | sort

echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "  1. Test executables on target platforms"
echo "  2. Create release packages"
echo "  3. Upload to distribution channels"
echo ""
echo -e "${GREEN}🚀 Ready for distribution!${NC}"